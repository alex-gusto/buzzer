const STORAGE_KEY = "buzzer-host-secrets";

type StoredSecrets = Record<string, string>;

function readSecrets(): StoredSecrets {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const result: StoredSecrets = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") {
        result[key] = value;
      }
    }

    return result;
  } catch {
    return {};
  }
}

function writeSecrets(data: StoredSecrets) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to persist host secret", error);
  }
}

export function saveHostSecret(code: string, hostSecret: string) {
  const key = code.toUpperCase();
  const secrets = readSecrets();
  if (secrets[key] === hostSecret) {
    return;
  }
  secrets[key] = hostSecret;
  writeSecrets(secrets);
}

export function getHostSecret(code: string): string | null {
  const key = code.toUpperCase();
  const secrets = readSecrets();
  return secrets[key] ?? null;
}

export function clearHostSecret(code: string) {
  const key = code.toUpperCase();
  const secrets = readSecrets();
  if (!(key in secrets)) {
    return;
  }
  delete secrets[key];
  writeSecrets(secrets);
}
