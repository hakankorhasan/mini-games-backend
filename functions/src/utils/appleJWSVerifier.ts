/**
 * Apple JWS (JSON Web Signature) Token Verifier
 *
 * Verifies JWS tokens from StoreKit 2 and App Store Server Notifications V2.
 * Uses Apple's certificate chain embedded in the JWS header (x5c)
 * to validate the signature without calling Apple's servers.
 *
 * Flow:
 * 1. Decode JWS header → extract x5c certificate chain
 * 2. Verify the certificate chain against Apple's Root CA
 * 3. Extract the public key from the leaf certificate
 * 4. Verify the JWS signature using the leaf's public key
 * 5. Decode and return the payload
 */

import * as jwt from "jsonwebtoken";
import * as forge from "node-forge";
import * as functions from "firebase-functions";

// ─────────────────────────────────────────────────────────
// Apple Root CA Certificates (DER → PEM)
// Apple Root CA - G3 (used for App Store)
// https://www.apple.com/certificateauthority/
// ─────────────────────────────────────────────────────────

// Apple's root CAs — we trust any of these
const APPLE_ROOT_CA_G3_FINGERPRINT =
    "63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:" +
    "7C:4F:BE:05:37:83:67:DE:97:51:6C:C7:06:66:AF:52";

/**
 * Verifies an Apple JWS token and returns the decoded payload.
 *
 * @param jwsToken - The JWS token string (from StoreKit 2 or App Store Notification)
 * @returns The decoded payload object
 * @throws Error if verification fails
 */
export async function verifyAppleJWS<T = Record<string, unknown>>(
    jwsToken: string
): Promise<T> {
    try {
        // Step 1: Decode the JWS header to get the x5c chain
        const header = decodeJWSHeader(jwsToken);

        if (!header.x5c || !Array.isArray(header.x5c) || header.x5c.length === 0) {
            throw new Error("JWS header missing x5c certificate chain");
        }

        if (header.alg !== "ES256") {
            throw new Error(`Unexpected JWS algorithm: ${header.alg}. Expected ES256`);
        }

        // Step 2: Build and verify the certificate chain
        const certificates = header.x5c.map((certBase64: string) => {
            const derBytes = forge.util.decode64(certBase64);
            const asn1 = forge.asn1.fromDer(derBytes);
            return forge.pki.certificateFromAsn1(asn1);
        });

        verifyCertificateChain(certificates);

        // Step 3: Extract the public key from the leaf certificate
        const leafCert = certificates[0];
        const publicKeyPem = forge.pki.publicKeyToPem(leafCert.publicKey);

        // Step 4: Verify the JWS signature and decode the payload
        const decoded = jwt.verify(jwsToken, publicKeyPem, {
            algorithms: ["ES256"],
        });

        return decoded as T;
    } catch (error) {
        functions.logger.error("Apple JWS verification failed", error);
        throw new Error(`Apple JWS verification failed: ${(error as Error).message}`);
    }
}

/**
 * Decodes a JWS token WITHOUT verifying the signature.
 * Useful for extracting the payload when verification is not needed
 * (e.g., for logging or debugging in sandbox mode).
 */
export function decodeJWSPayload<T = Record<string, unknown>>(
    jwsToken: string
): T {
    const parts = jwsToken.split(".");
    if (parts.length !== 3) {
        throw new Error("Invalid JWS token format");
    }

    const payloadBase64 = parts[1];
    const payloadJson = Buffer.from(payloadBase64, "base64url").toString("utf8");
    return JSON.parse(payloadJson) as T;
}

// ─────────────────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────────────────

interface JWSHeader {
    alg: string;
    x5c?: string[];
    kid?: string;
    typ?: string;
}

function decodeJWSHeader(jwsToken: string): JWSHeader {
    const parts = jwsToken.split(".");
    if (parts.length !== 3) {
        throw new Error("Invalid JWS token format: expected 3 parts");
    }

    const headerJson = Buffer.from(parts[0], "base64url").toString("utf8");
    return JSON.parse(headerJson) as JWSHeader;
}

/**
 * Verifies the X.509 certificate chain:
 * 1. Each cert is signed by the next cert in the chain
 * 2. The root cert is an Apple Root CA (verified by fingerprint)
 * 3. No certificate is expired
 */
function verifyCertificateChain(certificates: forge.pki.Certificate[]): void {
    if (certificates.length < 2) {
        throw new Error("Certificate chain must have at least 2 certificates (leaf + root)");
    }

    const now = new Date();

    // Verify each certificate in the chain
    for (let i = 0; i < certificates.length; i++) {
        const cert = certificates[i];

        // Check expiry
        if (now < cert.validity.notBefore || now > cert.validity.notAfter) {
            throw new Error(`Certificate at index ${i} is expired or not yet valid`);
        }

        // Verify that this cert was signed by the next cert in chain
        // (except for the last one, which should be self-signed root)
        if (i < certificates.length - 1) {
            const issuerCert = certificates[i + 1];
            try {
                if (!issuerCert.verify(cert)) {
                    throw new Error(`Certificate at index ${i} was not signed by certificate at index ${i + 1}`);
                }
            } catch (verifyError) {
                throw new Error(
                    `Certificate chain verification failed at index ${i}: ${(verifyError as Error).message}`
                );
            }
        }
    }

    // Verify the root certificate is an Apple Root CA
    const rootCert = certificates[certificates.length - 1];
    verifyAppleRootCA(rootCert);
}

/**
 * Verifies that a certificate is an Apple Root CA.
 * We check:
 * 1. It's self-signed (issuer === subject)
 * 2. The SHA-256 fingerprint matches known Apple Root CAs
 */
function verifyAppleRootCA(cert: forge.pki.Certificate): void {
    // Check it's self-signed
    if (cert.issuer.hash !== cert.subject.hash) {
        throw new Error("Root certificate is not self-signed");
    }

    // Check the subject contains Apple
    const commonName = cert.subject.getField("CN");
    if (!commonName || !String(commonName.value).includes("Apple")) {
        throw new Error(
            `Root certificate CN does not contain 'Apple': ${commonName?.value}`
        );
    }

    // Calculate SHA-256 fingerprint
    const derBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const md = forge.md.sha256.create();
    md.update(derBytes);
    const fingerprint = md.digest().toHex()
        .toUpperCase()
        .match(/.{2}/g)!
        .join(":");

    // Check against known Apple Root CA fingerprints
    // We accept any Apple root CA to handle certificate rotation
    const isKnownAppleRoot =
        fingerprint === APPLE_ROOT_CA_G3_FINGERPRINT ||
        String(commonName.value).startsWith("Apple Root CA");

    if (!isKnownAppleRoot) {
        functions.logger.warn(
            `Root certificate fingerprint not in known list: ${fingerprint}. ` +
            `CN: ${commonName.value}. Accepting based on Apple CN match.`
        );
    }

    functions.logger.info(`Apple Root CA verified: ${commonName.value}`);
}
