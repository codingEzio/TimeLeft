import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const workspace = Deno.env.get("TIMELEFT_WORKSPACE") ?? dirname(root),
  runtime = join(root, "Local", "runtime"),
  deploy = join(root, "deploy");
const label = Deno.env.get("TIMELEFT_SERVICE_LABEL") ?? "org.timeleft.web",
  project = Deno.env.get("TIMELEFT_PROJECT") ?? "X-TimeLeft",
  compose = join(runtime, "process-compose.yaml"),
  plist = join(deploy, `${label}.plist`);
if (!/^[A-Za-z0-9._-]+$/.test(label) || !/^[A-Za-z0-9._-]+$/.test(project)) {
  throw Error("Invalid service label or project name");
}
const home = Deno.env.get("HOME");
if (!home) throw Error("HOME is required");
const deno = Deno.execPath(),
  manager = Deno.env.get("TIMELEFT_PROCESS_COMPOSE") ??
    "/opt/homebrew/bin/process-compose",
  wrapper = join(workspace, ".runtime", "run-project.sh");
const quote = (s: string) =>
  /^[A-Za-z0-9_./:@=-]+$/.test(s) ? s : "'" + s.replaceAll("'", "'\\''") + "'";
const xml = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const command = [
  wrapper,
  project,
  "frontend",
  "--reclaim-port",
  "--",
  deno,
  "run",
  "--allow-net",
  "--allow-read",
  "--allow-env=PROJECT_PORT",
  join(root, "scripts", "serve.ts"),
].map(quote).join(" ");
const yaml =
  `version: "0.5"\nis_strict: true\nis_tui_disabled: true\nlog_level: info\nlog_length: 300\nlog_location: ${
    JSON.stringify(join(runtime, "process-compose.log"))
  }\nlog_configuration:\n  rotation:\n    max_size_mb: 5\n    max_age_days: 7\n    max_backups: 2\n    compress: true\nprocesses:\n  timeleft-web:\n    description: TimeLeft web 0.0.0.0\n    command: ${
    JSON.stringify(`exec ${command}`)
  }\n    working_dir: ${
    JSON.stringify(root)
  }\n    availability:\n      restart: always\n      backoff_seconds: 2\n    shutdown:\n      signal: 15\n      timeout_seconds: 15\n`;
// The shared runtime verifier identifies the exact wrapper in the command.
const normalizedYaml = yaml;
const document =
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n<key>Label</key><string>${label}</string>\n<key>ProgramArguments</key><array><string>${
    xml(manager)
  }</string><string>-f</string><string>${
    xml(compose)
  }</string><string>--no-server</string><string>up</string></array>\n<key>WorkingDirectory</key><string>${
    xml(root)
  }</string>\n<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>5</integer><key>ExitTimeOut</key><integer>35</integer>\n<key>EnvironmentVariables</key><dict><key>PATH</key><string>${
    xml(Deno.env.get("PATH") ?? "/opt/homebrew/bin:/usr/bin:/bin")
  }</string><key>HOME</key><string>${
    xml(home)
  }</string><key>PC_DISABLE_DOTENV</key><string>1</string><key>PC_LOG_FILE</key><string>/dev/null</string></dict>\n<key>StandardOutPath</key><string>/dev/null</string><key>StandardErrorPath</key><string>/dev/null</string>\n</dict></plist>\n`;
if (
  Deno.args.length !== 1 || !["--prepare", "--install"].includes(Deno.args[0])
) throw Error("Use --prepare or --install");
await Deno.stat(join(root, "dist", "index.html"));
await Deno.stat(manager);
await Deno.stat(wrapper);
await Deno.mkdir(runtime, { recursive: true });
await Deno.mkdir(deploy, { recursive: true });
await Deno.writeTextFile(compose, normalizedYaml);
await Deno.writeTextFile(plist, document);
const check = await new Deno.Command("/usr/bin/plutil", {
  args: ["-lint", plist],
  stdout: "piped",
  stderr: "piped",
}).output();
if (!check.success) throw Error("Generated launch agent failed validation");
if (Deno.args[0] === "--prepare") {
  console.log(`Prepared ${compose} and ${plist}`);
  Deno.exit(0);
}
if (Deno.build.os !== "darwin") throw Error("Installation requires macOS");
const target = join(home, "Library", "LaunchAgents", `${label}.plist`);
try {
  await Deno.lstat(target);
  throw Error(`Refusing to overwrite ${target}`);
} catch (error) {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
}
const uid = new TextDecoder().decode(
  (await new Deno.Command("/usr/bin/id", { args: ["-u"] }).output()).stdout,
).trim();
const domain = `gui/${uid}`;
if (
  (await new Deno.Command("/bin/launchctl", {
    args: ["print", `${domain}/${label}`],
    stdout: "null",
    stderr: "null",
  }).output()).success
) throw Error("LaunchAgent already loaded");
const entry = await new Deno.Command(deno, {
  args: [
    "run",
    "--allow-read",
    join(workspace, ".runtime", "ports.ts"),
    "get",
    project,
  ],
  stdout: "piped",
  stderr: "piped",
}).output();
if (!entry.success) {
  throw Error("TimeLeft registry entry is required before install");
}
const registration = JSON.parse(new TextDecoder().decode(entry.stdout));
if (
  registration.runtime?.composeFile !==
    `${project}/Local/runtime/process-compose.yaml` ||
  registration.runtime?.launchAgentLabel !== label
) throw Error("Registry runtime mismatch");
await Deno.mkdir(dirname(target), { recursive: true });
await Deno.copyFile(plist, target);
const result = await new Deno.Command("/bin/launchctl", {
  args: ["bootstrap", domain, target],
  stdout: "inherit",
  stderr: "inherit",
}).output();
if (!result.success) {
  await Deno.remove(target);
  throw Error("LaunchAgent bootstrap failed");
}
console.log(`Installed ${label} on ${registration.frontend}`);
