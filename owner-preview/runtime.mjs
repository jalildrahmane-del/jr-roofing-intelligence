import { execFileSync } from "node:child_process";
import { join } from "node:path";
export function windowsVault(operation, input) {
  if (process.platform !== "win32")
    throw Error("Secure login storage requires Windows 10/11.");
  const command =
    "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd().Trim()); $r=[System.Security.Cryptography.ProtectedData]::" +
    (operation === "protect" ? "Protect" : "Unprotect") +
    "($b,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($r))";
  try {
    return Buffer.from(
      execFileSync(
        join(
          process.env.SystemRoot || "C:\\Windows",
          "System32",
          "WindowsPowerShell",
          "v1.0",
          "powershell.exe",
        ),
        ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command],
        {
          input: Buffer.from(input).toString("base64"),
          encoding: "utf8",
          windowsHide: true,
          maxBuffer: 1024 * 1024,
          stdio: ["pipe", "pipe", "pipe"],
        },
      ).trim(),
      "base64",
    );
  } catch {
    throw Error(
      "Windows could not access your private login storage. No security settings were changed. Please share this message for help.",
    );
  }
}
