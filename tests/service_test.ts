Deno.test("service preparation reuses identical files and refuses conflicts and symlinks", async () => {
  const temp = await Deno.makeTempDir({ prefix: "timeleft-service-test-" });
  const workspace = `${temp}/workspace`;
  const home = `${temp}/home`;
  const label = "org.timeleft.test";
  const env = {
    HOME: home,
    TIMELEFT_WORKSPACE: workspace,
    TIMELEFT_PROCESS_COMPOSE: "/usr/bin/true",
    TIMELEFT_SERVICE_LABEL: label,
  };
  async function fixture(name: string) {
    const root = `${temp}/${name}`;
    await Deno.mkdir(`${root}/scripts`, { recursive: true });
    await Deno.mkdir(`${root}/dist`, { recursive: true });
    await Deno.copyFile(
      new URL("../scripts/service.ts", import.meta.url),
      `${root}/scripts/service.ts`,
    );
    await Deno.writeTextFile(`${root}/dist/index.html`, "synthetic");
    return root;
  }
  async function run(root: string, mode: string) {
    return await new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", `${root}/scripts/service.ts`, mode],
      env,
      stdout: "piped",
      stderr: "piped",
    }).output();
  }
  function assert(value: unknown, message: string): asserts value {
    if (!value) throw Error(message);
  }
  async function missing(path: string) {
    try {
      await Deno.lstat(path);
      return false;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return true;
      throw error;
    }
  }
  try {
    await Deno.mkdir(`${workspace}/.runtime`, { recursive: true });
    await Deno.writeTextFile(
      `${workspace}/.runtime/run-project.sh`,
      "synthetic",
    );
    await Deno.mkdir(`${home}/Library/LaunchAgents`, { recursive: true });
    const good = await fixture("good");
    assert((await run(good, "--prepare")).success, "initial prepare failed");
    const compose = `${good}/Local/runtime/process-compose.yaml`;
    const plist = `${good}/deploy/${label}.plist`;
    const before = [
      await Deno.readTextFile(compose),
      await Deno.readTextFile(plist),
    ];
    const beforeStats = [await Deno.stat(compose), await Deno.stat(plist)];
    assert((await run(good, "--prepare")).success, "identical prepare failed");
    const afterStats = [await Deno.stat(compose), await Deno.stat(plist)];
    assert(
      beforeStats.every((info, i) =>
        info.ino === afterStats[i].ino &&
        info.mtime?.getTime() === afterStats[i].mtime?.getTime()
      ),
      "identical files rewritten",
    );
    const installAfterPrepare = await run(good, "--install");
    assert(
      !installAfterPrepare.success &&
        new TextDecoder().decode(installAfterPrepare.stderr).includes(
          "registry entry is required",
        ),
      "install did not reach registry preflight after prepare",
    );
    assert(
      before[0] === await Deno.readTextFile(compose) &&
        before[1] === await Deno.readTextFile(plist),
      "reused files changed",
    );
    for (
      const [path, other, otherContent] of [[compose, plist, before[1]], [
        plist,
        compose,
        before[0],
      ]]
    ) {
      const original = await Deno.readTextFile(path);
      await Deno.writeTextFile(path, "conflict");
      assert(!(await run(good, "--prepare")).success, "conflict accepted");
      assert(
        await Deno.readTextFile(path) === "conflict" &&
          await Deno.readTextFile(other) === otherContent,
        "conflict changed files",
      );
      await Deno.writeTextFile(path, original);
    }
    for (const kind of ["parent", "runtime", "deploy", "compose", "plist"]) {
      const root = await fixture(kind);
      const outside = `${temp}/${kind}-outside`;
      await Deno.writeTextFile(outside, "unchanged");
      if (kind === "parent") {
        await Deno.symlink(temp, `${root}/Local`);
      } else if (kind === "runtime") {
        await Deno.mkdir(`${root}/Local`, { recursive: true });
        await Deno.symlink(temp, `${root}/Local/runtime`);
      } else if (kind === "deploy") {
        await Deno.symlink(temp, `${root}/deploy`);
      } else {
        await Deno.mkdir(`${root}/Local/runtime`, { recursive: true });
        await Deno.mkdir(`${root}/deploy`, { recursive: true });
        await Deno.symlink(
          outside,
          kind === "compose"
            ? `${root}/Local/runtime/process-compose.yaml`
            : `${root}/deploy/${label}.plist`,
        );
      }
      assert(
        !(await run(root, "--prepare")).success,
        `${kind} symlink accepted`,
      );
      assert(
        await Deno.readTextFile(outside) === "unchanged",
        `${kind} target changed`,
      );
      if (kind === "plist") {
        assert(
          await missing(`${root}/Local/runtime/process-compose.yaml`),
          "partial compose written",
        );
      }
    }
    const install = await fixture("install");
    const target = `${home}/Library/LaunchAgents/${label}.plist`;
    await Deno.writeTextFile(target, "existing");
    assert(
      !(await run(install, "--install")).success,
      "existing LaunchAgent accepted",
    );
    assert(
      await Deno.readTextFile(target) === "existing" &&
        await missing(`${install}/Local`) && await missing(`${install}/deploy`),
      "install changed files",
    );
  } finally {
    await Deno.remove(temp, { recursive: true });
  }
});
