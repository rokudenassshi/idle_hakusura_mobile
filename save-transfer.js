function collectLocalStorageSnapshot({ schema, gameVersion }) {
  const now = new Date();
  const storage = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    storage[key] = localStorage.getItem(key);
  }
  return {
    schema,
    gameVersion: typeof gameVersion === "string" ? gameVersion : null,
    exportedAt: now.toISOString(),
    storage,
  };
}

function downloadSnapshotAsJson(filename, snapshot) {
  const blob = new Blob([JSON.stringify(snapshot)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function readSnapshotFromFile(file) {
  const text = await file.text();
  return JSON.parse(text);
}

function validateSnapshotSchema(payload, schema) {
  if (!payload || typeof payload !== "object") {
    throw new Error("invalid payload");
  }
  if (payload.schema !== schema) {
    throw new Error("unknown schema");
  }
  if (!payload.storage || typeof payload.storage !== "object") {
    throw new Error("invalid storage");
  }
  return payload;
}

function restoreLocalStorageSnapshot(snapshot) {
  Object.entries(snapshot.storage).forEach(([key, value]) => {
    if (typeof value === "string") {
      localStorage.setItem(key, value);
    }
  });
}

window.SaveTransfer = {
  collectLocalStorageSnapshot,
  downloadSnapshotAsJson,
  readSnapshotFromFile,
  validateSnapshotSchema,
  restoreLocalStorageSnapshot,
};
