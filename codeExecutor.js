require('dotenv').config();
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CACHE_TTL_MS_SHORT = 2 * 60 * 1000; // 2 minutes

function cleanupCache(cacheRoot, maxAgeMs) {
  if (!fs.existsSync(cacheRoot)) return;
  const now = Date.now();
  fs.readdirSync(cacheRoot).forEach(folder => {
    const folderPath = path.join(cacheRoot, folder);
    const lastUsedFile = path.join(folderPath, '.lastused');
    let lastUsed = 0;
    if (fs.existsSync(lastUsedFile)) {
      lastUsed = parseInt(fs.readFileSync(lastUsedFile, 'utf8'), 10);
    }
    if (!lastUsed || now - lastUsed > maxAgeMs) {
      fs.rmSync(folderPath, { recursive: true, force: true });
    }
  });
}

function touchCache(folder) {
  fs.writeFileSync(path.join(folder, '.lastused'), Date.now().toString());
}

function executeJava(code, input, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const match = code.match(/public\s+class\s+(\w+)/);
    if (!match) return resolve({ error: 'No public class found' });

    const className = match[1];
    const hash = crypto.createHash('md5').update(code).digest('hex');
    const cacheDir = path.join(__dirname, 'java_cache', hash);
    const javaFile = path.join(cacheDir, `${className}.java`);
    const classFile = path.join(cacheDir, `${className}.class`);

    cleanupCache(path.join(__dirname, 'java_cache'), CACHE_TTL_MS_SHORT);
    fs.mkdirSync(cacheDir, { recursive: true });
    touchCache(cacheDir);
    fs.writeFileSync(javaFile, code);

    const compileStart = process.hrtime.bigint();

    if (fs.existsSync(classFile)) {
      runJava(0);
    } else {
      const javac = spawn('javac', [javaFile]);
      let compileError = '';
      javac.stderr.on('data', (data) => { compileError += data.toString(); });
      javac.on('close', (exitCode) => {
        const compileTimeMs = Math.round(Number(process.hrtime.bigint() - compileStart) / 1e6);
        if (exitCode !== 0) return resolve({ error: 'Compilation Error', details: compileError.trim(), compileTimeMs });
        runJava(compileTimeMs);
      });
    }

    function runJava(compileTimeMs) {
      const execStart = process.hrtime.bigint();
      const java = spawn('java', ['-cp', cacheDir, className]);
      let output = '';
      let runtimeError = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        java.kill('SIGKILL');
      }, timeoutMs);

      java.stdout.on('data', (data) => { output += data.toString(); });
      java.stderr.on('data', (data) => { runtimeError += data.toString(); });
      java.on('close', (exitCode) => {
        clearTimeout(timer);
        const execTimeMs = Math.round(Number(process.hrtime.bigint() - execStart) / 1e6);
        const memBytes = Math.round(process.memoryUsage().rss / 1024);
        if (timedOut) return resolve({ error: 'Time Limit Exceeded', compileTimeMs, execTimeMs, memBytes });
        if (exitCode !== 0) return resolve({ error: 'Runtime Error', details: runtimeError.trim(), compileTimeMs, execTimeMs, memBytes });
        resolve({ output: output.trim(), compileTimeMs, execTimeMs, memBytes });
      });

      if (input) java.stdin.write(input + '\n');
      java.stdin.end();
    }
  });
}

function executeCSharp(code, input, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const hash = crypto.createHash('md5').update(code).digest('hex');
    const cacheDir = path.join(__dirname, 'csharp_cache', hash);
    const projFile = path.join(cacheDir, 'app.csproj');
    const csFile = path.join(cacheDir, 'Program.cs');
    const dllFile = path.join(cacheDir, 'bin', 'Debug', 'net6.0', 'app.dll');

    cleanupCache(path.join(__dirname, 'csharp_cache'), CACHE_TTL_MS_SHORT);
    fs.mkdirSync(cacheDir, { recursive: true });
    touchCache(cacheDir);

    if (!fs.existsSync(projFile)) {
      spawnSync('dotnet', ['new', 'console', '-n', 'app', '-o', cacheDir], { stdio: 'inherit' });
    }

    fs.writeFileSync(csFile, code);
    const compileStart = process.hrtime.bigint();

    if (fs.existsSync(dllFile)) {
      runCSharp(0);
    } else {
      const build = spawn('dotnet', ['build', cacheDir, '-nowarn:CS8600']);
      let buildError = '';
      build.stderr.on('data', (data) => { buildError += data.toString(); });
      build.on('close', (exitCode) => {
        const compileTimeMs = Math.round(Number(process.hrtime.bigint() - compileStart) / 1e6);
        if (exitCode !== 0) return resolve({ error: 'Compilation Error', details: buildError.trim(), compileTimeMs });
        runCSharp(compileTimeMs);
      });
    }

    function runCSharp(compileTimeMs) {
      const execStart = process.hrtime.bigint();
      const run = spawn('dotnet', [dllFile]);
      let output = '';
      let runtimeError = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        run.kill('SIGKILL');
      }, timeoutMs);

      run.stdout.on('data', (data) => {
        output += data.toString();
        output = output.split('\n').filter(line => !line.includes('warning CS')).join('\n');
      });
      run.stderr.on('data', (data) => { runtimeError += data.toString(); });
      run.on('close', (exitCode) => {
        clearTimeout(timer);
        const execTimeMs = Math.round(Number(process.hrtime.bigint() - execStart) / 1e6);
        const memBytes = Math.round(process.memoryUsage().rss / 1024);
        if (timedOut) return resolve({ error: 'Time Limit Exceeded', compileTimeMs, execTimeMs, memBytes });
        if (exitCode !== 0) return resolve({ error: 'Runtime Error', details: runtimeError.trim(), compileTimeMs, execTimeMs, memBytes });
        resolve({ output: output.trim(), compileTimeMs, execTimeMs, memBytes });
      });

      if (input) run.stdin.write(input + '\n');
      run.stdin.end();
    }
  });
}

function executeC(code, input, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const hash = crypto.createHash('md5').update(code).digest('hex');
    const tmpDir = path.join(__dirname, 'c_tmp');
    fs.mkdirSync(tmpDir, { recursive: true });
    const cFile = path.join(tmpDir, `prog_${hash}.c`);
    const outFile = path.join(tmpDir, `prog_${hash}.out`);

    fs.writeFileSync(cFile, code);
    const compileStart = process.hrtime.bigint();
    const gcc = spawn('gcc', [cFile, '-o', outFile]);
    let compileError = '';
    gcc.stderr.on('data', (data) => { compileError += data.toString(); });
    gcc.on('close', (exitCode) => {
      const compileTimeMs = Math.round(Number(process.hrtime.bigint() - compileStart) / 1e6);
      if (exitCode !== 0) return resolve({ error: 'Compilation Error', details: compileError.trim(), compileTimeMs });

      const execStart = process.hrtime.bigint();
      const run = spawn(outFile);
      let output = '';
      let runtimeError = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        run.kill('SIGKILL');
      }, timeoutMs);

      run.stdout.on('data', (data) => { output += data.toString(); });
      run.stderr.on('data', (data) => { runtimeError += data.toString(); });
      run.on('close', (runExitCode) => {
        clearTimeout(timer);
        const execTimeMs = Math.round(Number(process.hrtime.bigint() - execStart) / 1e6);
        const memBytes = Math.round(process.memoryUsage().rss / 1024);
        try { fs.unlinkSync(cFile); fs.unlinkSync(outFile); } catch (_) {}
        if (timedOut) return resolve({ error: 'Time Limit Exceeded', compileTimeMs, execTimeMs, memBytes });
        if (runExitCode !== 0) return resolve({ error: 'Runtime Error', details: runtimeError.trim(), compileTimeMs, execTimeMs, memBytes });
        resolve({ output: output.trim(), compileTimeMs, execTimeMs, memBytes });
      });

      if (input) run.stdin.write(input + '\n');
      run.stdin.end();
    });
  });
}

function executeCpp(code, input, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const hash = crypto.createHash('md5').update(code).digest('hex');
    const cacheDir = path.join(__dirname, 'cpp_cache', hash);
    const cppFile = path.join(cacheDir, 'program.cpp');
    const outFile = path.join(cacheDir, 'program.out');

    cleanupCache(path.join(__dirname, 'cpp_cache'), CACHE_TTL_MS_SHORT);
    fs.mkdirSync(cacheDir, { recursive: true });
    touchCache(cacheDir);
    fs.writeFileSync(cppFile, code);

    const compileStart = process.hrtime.bigint();

    if (fs.existsSync(outFile)) {
      runCpp(0);
    } else {
      const gpp = spawn('g++', ['-o', outFile, cppFile]);
      let compileError = '';
      gpp.stderr.on('data', (data) => { compileError += data.toString(); });
      gpp.on('close', (exitCode) => {
        const compileTimeMs = Math.round(Number(process.hrtime.bigint() - compileStart) / 1e6);
        if (exitCode !== 0) return resolve({ error: 'Compilation Error', details: compileError.trim(), compileTimeMs });
        runCpp(compileTimeMs);
      });
    }

    function runCpp(compileTimeMs) {
      const execStart = process.hrtime.bigint();
      const run = spawn(outFile);
      let output = '';
      let runtimeError = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        run.kill('SIGKILL');
      }, timeoutMs);

      run.stdout.on('data', (data) => { output += data.toString(); });
      run.stderr.on('data', (data) => { runtimeError += data.toString(); });
      run.on('close', (exitCode) => {
        clearTimeout(timer);
        const execTimeMs = Math.round(Number(process.hrtime.bigint() - execStart) / 1e6);
        const memBytes = Math.round(process.memoryUsage().rss / 1024);
        if (timedOut) return resolve({ error: 'Time Limit Exceeded', compileTimeMs, execTimeMs, memBytes });
        if (exitCode !== 0) return resolve({ error: 'Runtime Error', details: runtimeError.trim(), compileTimeMs, execTimeMs, memBytes });
        resolve({ output: output.trim(), compileTimeMs, execTimeMs, memBytes });
      });

      if (input) run.stdin.write(input + '\n');
      run.stdin.end();
    }
  });
}

function executePython(code, input, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const hash = crypto.createHash('md5').update(code).digest('hex');
    const tmpDir = path.join(__dirname, 'py_tmp');
    fs.mkdirSync(tmpDir, { recursive: true });
    const pyFile = path.join(tmpDir, `script_${hash}.py`);

    fs.writeFileSync(pyFile, code);
    const execStart = process.hrtime.bigint();
    const py = spawn('python', [pyFile]);
    let output = '';
    let runtimeError = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      py.kill('SIGKILL');
    }, timeoutMs);

    py.stdout.on('data', (data) => { output += data.toString(); });
    py.stderr.on('data', (data) => { runtimeError += data.toString(); });
    py.on('close', (exitCode) => {
      clearTimeout(timer);
      const execTimeMs = Math.round(Number(process.hrtime.bigint() - execStart) / 1e6);
      const memBytes = Math.round(process.memoryUsage().rss / 1024);
      try { fs.unlinkSync(pyFile); } catch (_) {}
      if (timedOut) return resolve({ error: 'Time Limit Exceeded', execTimeMs, memBytes });
      if (exitCode !== 0) return resolve({ error: 'Runtime Error', details: runtimeError.trim(), execTimeMs, memBytes });
      resolve({ output: output.trim(), execTimeMs, memBytes });
    });

    if (input) py.stdin.write(input + '\n');
    py.stdin.end();
  });
}

async function executeCode(language, code, input, timeoutMs = 10000) {
  const lang = (language || 'java').toLowerCase().trim();
  if (lang === 'java') return executeJava(code, input, timeoutMs);
  if (lang === 'c#' || lang === 'csharp') return executeCSharp(code, input, timeoutMs);
  if (lang === 'c') return executeC(code, input, timeoutMs);
  if (lang === 'c++' || lang === 'cpp') return executeCpp(code, input, timeoutMs);
  if (lang === 'python') return executePython(code, input, timeoutMs);
  return { error: `Unsupported language for auto-execution: ${language}` };
}

module.exports = { executeCode, executeJava, executeCSharp, executeC, executeCpp, executePython };
