const fontPath = new URL(
  "../assets/fonts/DeparturePixelZhCompact-d5eeaff4.woff2",
  import.meta.url,
);
let fontBytes: Uint8Array<ArrayBuffer>;
try {
  fontBytes = await Deno.readFile(fontPath);
} catch (error) {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
  throw new Error(
    "Font missing / 缺少字型 / 缺少字体: python3 scripts/prepare_font.py RELEASE.zip",
  );
}
const fontHash = Array.from(
  new Uint8Array(await crypto.subtle.digest("SHA-256", fontBytes)),
  (b) => b.toString(16).padStart(2, "0"),
).join("");
if (
  fontHash !==
    "d5eeaff49ffc69fc14b4ee8a5f79a6e80febff358e5367c2f41b51970f5dcf19"
) {
  throw new Error(
    "Font SHA-256 mismatch / 字型雜湊不符 / 字体哈希不符: python3 scripts/prepare_font.py RELEASE.zip",
  );
}
const out = new URL("../dist/", import.meta.url);
await Deno.mkdir(out, { recursive: true });
const temporary = await Deno.makeTempDir({
  dir: out.pathname,
  prefix: ".build-",
});
try {
  const command = new Deno.Command(Deno.execPath(), {
    cwd: new URL("../", import.meta.url),
    args: [
      "bundle",
      "--platform=browser",
      "--minify",
      `--output=${temporary}/app.js`,
      "src/main.ts",
    ],
    stdout: "inherit",
    stderr: "inherit",
  });
  if (!(await command.output()).success) throw Error("Browser bundle failed");
  const inputs: [string, string][] = [
    ["index.html", "index.html"],
    ["style.css", "style.css"],
    ["canvas.css", "src/canvas.css"],
    [
      "DeparturePixelZhCompact-d5eeaff4.woff2",
      "assets/fonts/DeparturePixelZhCompact-d5eeaff4.woff2",
    ],
  ];
  for (const [dest, source] of inputs) {
    await Deno.copyFile(
      new URL(`../${source}`, import.meta.url),
      `${temporary}/${dest}`,
    );
  }
  // Keep the existing font/component notices with the independently usable dist.
  const fontRoot = new URL("../assets/fonts/", import.meta.url);
  const components: string[] = [];
  for await (const item of Deno.readDir(new URL("Licenses/", fontRoot))) {
    if (item.isFile && item.name.endsWith(".txt")) {
      components.push(`Licenses/${item.name}`);
    }
  }
  const encoder = new TextEncoder();
  const notices = [encoder.encode("Bundled font notices and provenance\n")];
  for (
    const name of [
      "NOTICE-CORRECTIONS.md",
      "NOTICE.md",
      "OFL.txt",
      "provenance.json",
      ...components.sort(),
    ]
  ) {
    notices.push(encoder.encode(`\n\n--- assets/fonts/${name} ---\n\n`));
    notices.push(await Deno.readFile(new URL(name, fontRoot)));
  }
  const combined = new Uint8Array(
    notices.reduce((size, part) => size + part.length, 0),
  );
  let offset = 0;
  for (const part of notices) {
    combined.set(part, offset);
    offset += part.length;
  }
  await Deno.writeFile(`${temporary}/font-notices.txt`, combined);
  await Deno.copyFile(
    new URL("../LICENSE", import.meta.url),
    `${temporary}/LICENSE.txt`,
  );
  const hashParts: string[] = [];
  for (
    const file of [
      "index.html",
      "style.css",
      "canvas.css",
      "app.js",
      "DeparturePixelZhCompact-d5eeaff4.woff2",
    ]
  ) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      await Deno.readFile(`${temporary}/${file}`),
    );
    hashParts.push(
      Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, "0"))
        .join(""),
    );
  }
  const sw = await Deno.readTextFile(new URL("../src/sw.js", import.meta.url));
  const revision = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(hashParts.join("") + sw),
      ),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("").slice(0, 20);
  await Deno.writeTextFile(
    `${temporary}/sw.js`,
    sw.replace("__REVISION__", revision),
  );
  for (
    const file of [
      "style.css",
      "canvas.css",
      "app.js",
      "index.html",
      "DeparturePixelZhCompact-d5eeaff4.woff2",
      "sw.js",
      "LICENSE.txt",
      "font-notices.txt",
    ]
  ) await Deno.rename(`${temporary}/${file}`, new URL(file, out));
  console.log(`Built dist/ (${revision})`);
} finally {
  await Deno.remove(temporary, { recursive: true });
}
