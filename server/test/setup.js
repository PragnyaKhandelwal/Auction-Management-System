// Imported first by database tests: env.config.js exits if these are missing
import os from "node:os";
import path from "node:path";

process.env.MONGO_URL ??= "mongodb://placeholder";
process.env.JWT_SECRET ??= "test-secret";
process.env.ORIGIN ??= "http://localhost:5173";
process.env.MONGOMS_DOWNLOAD_DIR ??= path.join(
  os.homedir(),
  ".cache",
  "mongodb-binaries",
);
