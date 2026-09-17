type Args = {
  table: string;
  csvPath: string;
  host: string;
  port: number;
  db: string;
  user: string;
  password?: string;
  update: boolean;
};

export function parseArgs(command: "seed" | "validate-catalog" = "seed"): Args {
  const argv = process.argv.slice(2);

  const positionalCount = command === "seed" ? 2 : 1;

  if (argv.length < positionalCount) {
    throw new Error(
      [
        "Usage:",
        `  npm run ${command} -- ${command === "seed" ? "<table> " : ""}<csv> --db <database> --user <user>`,
        "",
        "Example:",
        "  npm run seed -- entity_search entities.csv --db triplepeek --user akhomich",
      ].join("\n")
    );
  }

  const table = command === "seed" ? argv[0] : "";
  const csvPath = argv[positionalCount - 1];

  let host = "localhost";
  let port = 5432;
  let db: string | undefined;
  let user: string | undefined;
  let password: string | undefined;
  let update = false;

  for (let i = positionalCount; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case "--host":
        host = argv[++i];
        break;

      case "--port":
        port = Number(argv[++i]);
        break;

      case "--db":
        db = argv[++i];
        break;

      case "--user":
        user = argv[++i];
        break;

      case "--password":
        password = argv[++i];
        break;

      case "--update":
        if (command !== "seed") throw new Error("--update is only supported by seed");
        update = true;
        break;

      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!db) {
    throw new Error("--db is required");
  }

  if (!user) {
    throw new Error("--user is required");
  }

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("--port must be a valid positive integer");
  }

  return {
    table,
    csvPath,
    host,
    port,
    db,
    user,
    password,
    update,
  };
}

