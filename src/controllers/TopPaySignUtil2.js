import crypto from "crypto";
import https from "https";

// ✅ Corrected TopPay Sign Utility
class TopPaySignUtil2 {
  static RSA = "RSA";

  /**
   * Format parameters in alphabetical order and join as key=value&key=value
   */
  static paramFormat(param) {
    const sortedKeys = Object.keys(param).sort();
    const pairs = [];

    for (const key of sortedKeys) {
      const value = param[key];
      if (value !== null && value !== undefined && value.toString().trim() !== "") {
        pairs.push(`${key}=${value}`);
      }
    }

    return pairs.join("&");
  }

  /**
   * ✅ Correct RSA-SHA256 signing
   */
  static sign(privateKeyPem, source) {
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(source);
    signer.end();
    return signer.sign(privateKeyPem, "base64");
  }

  /**
   * ✅ Verify signature (optional)
   */
  static verify(publicKeyPem, source, sign) {
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(source);
    verifier.end();
    return verifier.verify(publicKeyPem, sign, "base64");
  }

  /**
   * ✅ Make HTTPS POST request
   */
  static doPost(url, json) {
    return new Promise((resolve, reject) => {
      const options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(json),
        },
      };

      const req = https.request(url, options, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode === 200) {
            resolve(data);
          } else {
            reject(new Error(`Request failed with status code ${res.statusCode}`));
          }
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      req.write(json);
      req.end();
    });
  }
}

export { TopPaySignUtil2 };