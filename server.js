// get endpoint
const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;
const fs = require('fs');
const path = require('path');
const { aiCODGenerator } = require('./aiCODGenerator');
// const { aiVerifyMcq } = require('./aiVerifyMcq');
const { uploadToPlatform } = require('./uploadToPlatform');
// const { runCode } = require('./runCode');
const axios = require('axios');
const { aiSolutionGenerator } = require('./aiSolutionGenerator');
const { validateSolution } = require('./codeValidator');
const { AVAILABLE_MODELS } = require('./llmClient');
const { router: authRouter } = require('./authRoutes');
const authMiddleware = require('./authMiddleware');
const { saveGeneratedQuestion, markAsUploaded, getGeneratedScenarios } = require('./questionRegistry');
const bodyParser = require("body-parser");
// const { spawn } = require("child_process");
const { spawn, spawnSync } = require("child_process");
require('dotenv').config();
const { MongoClient } = require('mongodb');



app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
}));
app.options('*', cors()); // handle preflight for all routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Auth routes (public) ──────────────────────────────────────────────────────
app.use('/auth', authRouter);

// ── Debug endpoint (public — remove after confirming auth works) ──────────────
app.get('/debug-auth', (req, res) => {
    const header = req.headers.authorization || '';
    const hasToken = header.startsWith('Bearer ') && header.length > 10;
    res.json({
        receivedAuthHeader: hasToken ? 'YES (token present)' : 'NO (missing or empty)',
        jwtSecretSet: !!process.env.JWT_SECRET,
    });
});

// ── Protected routes below ────────────────────────────────────────────────────
app.post("/generate-cod-description", authMiddleware, async (req, res) => {
    try {
        // Fetch previously generated scenario summaries for this user to prevent re-generation
        const excludeScenarios = await getGeneratedScenarios({
            generatedBy: req.user.username,
            language: req.body.language,
        }).catch(() => []);

        const result = await aiCODGenerator({ ...req.body, excludeScenarios, createdBy: req.user.username });
        res.status(200).send({ response: result });
    } catch (error) {
        console.error("Error in /generate-cod:", error);
        return res.status(500).send({ error: "Internal server error." });
    }
});

app.post("/generate-solution", authMiddleware, async (req, res) => {
    try {
        const { autoValidate = false, ...solveParams } = req.body;
        const response = await aiSolutionGenerator(solveParams);

        if (autoValidate && response?.[0]) {
            const solution = response[0];
            const validation = await validateSolution(
                solution.solution_data,
                solution.samples,
                solveParams.language,
                15000
            );
            return res.status(200).json({ response, validation });
        }

        res.status(200).json({ response });
    } catch (error) {
        console.error("Error in /generate-solution:", error);
        return res.status(500).send({ error: "Internal server error." });
    }
});

// app.post("/verify-mcq", async (req, res) => {
//     await aiVerifyMcq(req.body)
//         .then((response) => {
//             console.log(response);
//             res.status(200).send({ response });
//         })
//         .catch((error) => {
//             console.error("Error in /verify-mcq:", error);
//             res.status(500).send({ error: "Internal server error." });
//         });
// });

app.post("/upload-to-platform", authMiddleware, async (req, res) => {
    try {
        const response = await uploadToPlatform(req.body);

        // Mark question as uploaded in registry
        const uploadedItem = req.body.data;
        if (uploadedItem?.question_data) {
            await markAsUploaded({
                question_data: uploadedItem.question_data,
                uploadedBy: req.user?.username || 'unknown',
            }).catch(err => console.warn('[Registry] Failed to mark uploaded:', err.message));
        }

        res.status(200).send({ response });
    } catch (error) {
        console.error("Error in /upload-to-platform:", error);
        res.status(500).send({ error: "Internal server error." });
    }
});

// // app.post("/run-java", (req, res) => {
// //   const { code, input } = req.body;
// //   if (!code) return res.status(400).json({ error: "No code provided" });

// //   // Extract public class name
// //   const match = code.match(/public\s+class\s+(\w+)/);
// //   if (!match) return res.status(400).json({ error: "No public class found" });

// //   const className = match[1];
// //   const javaFile = path.join(__dirname, `${className}.java`);

// //   // Save code to file
// //   fs.writeFileSync(javaFile, code);

// //   // Compile step
// //   const javac = spawn("javac", [javaFile]);

// //   let compileError = "";
// //   javac.stderr.on("data", (data) => {
// //     compileError += data.toString();
// //   });

// //   javac.on("close", (compileCode) => {
// //     if (compileCode !== 0) {
// //       return res.json({ error: "Compilation Error", details: compileError.trim() });
// //     }

// //     // Track start time
// //     const startTime = process.hrtime.bigint(); // nanoseconds
// //     const java = spawn("java", ["-cp", __dirname, className]);

// //     let output = "";
// //     let runtimeError = "";

// //     java.stdout.on("data", (data) => {
// //       output += data.toString();
// //     });

// //     java.stderr.on("data", (data) => {
// //       runtimeError += data.toString();
// //     });

// //     java.on("close", (exitCode) => {
// //       const endTime = process.hrtime.bigint();
// //       const timeMs = Number(endTime - startTime) / 1e6; // convert ns → ms

// //       // Format values
// //       const timeBytes = Math.round(timeMs); // int ms
// //       const memBytes = Math.round(process.memoryUsage().rss / 1024); // KB

// //       if (exitCode !== 0) {
// //         return res.json({
// //           error: "Runtime Error",
// //           details: runtimeError.trim(),
// //           memBytes,
// //           timeBytes,
// //         });
// //       }

// //       res.json({
// //         output: output.trim(),
// //         memBytes,
// //         timeBytes,
// //       });
// //     });

// //     // Feed input if provided
// //     if (input) {
// //       java.stdin.write(input + "\n");
// //     }
// //     java.stdin.end();
// //   });
// // });

// app.post("/run-java", (req, res) => {
//   const { code, input } = req.body;
//   if (!code) return res.status(400).json({ error: "No code provided" });

//   // Extract public class name
//   const match = code.match(/public\s+class\s+(\w+)/);
//   if (!match) return res.status(400).json({ error: "No public class found" });

//   const className = match[1];
//   const javaFile = path.join(__dirname, `${className}.java`);

//   // Save code to file
//   fs.writeFileSync(javaFile, code);

//   // Track compile start
//   const compileStart = process.hrtime.bigint();
//   const javac = spawn("javac", [javaFile]);

//   let compileError = "";

//   javac.stderr.on("data", (data) => {
//     compileError += data.toString();
//   });

//   javac.on("close", (compileCode) => {
//     const compileEnd = process.hrtime.bigint();
//     const compileTimeMs = Number(compileEnd - compileStart) / 1e6; // ms

//     if (compileCode !== 0) {
//       return res.json({
//         error: "Compilation Error",
//         details: compileError.trim(),
//         compileTimeMs: Math.round(compileTimeMs),
//       });
//     }

//     // Execution step
//     const execStart = process.hrtime.bigint();
//     const java = spawn("java", ["-cp", __dirname, className]);

//     let output = "";
//     let runtimeError = "";

//     java.stdout.on("data", (data) => {
//       output += data.toString();
//     });

//     java.stderr.on("data", (data) => {
//       runtimeError += data.toString();
//     });

//     java.on("close", (exitCode) => {
//       const execEnd = process.hrtime.bigint();
//       const execTimeMs = Number(execEnd - execStart) / 1e6;
      
//       const timeBytes = Math.round(timeMs); // int ms
//       const memBytes = Math.round(process.memoryUsage().rss / 1024); // KB

//       if (exitCode !== 0) {
//         return res.json({
//           error: "Runtime Error",
//           details: runtimeError.trim(),
//           compileTimeMs: Math.round(compileTimeMs),
//           execTimeMs: Math.round(execTimeMs),
//           memBytes,
//           timeBytes
//         });
//       }

//       res.json({
//         output: output.trim(),
//         compileTimeMs: Math.round(compileTimeMs),
//         execTimeMs: Math.round(execTimeMs),
//         memBytes,
//         timeBytes
//       });
//     });

//     // Feed input if provided
//     if (input) {
//       java.stdin.write(input + "\n");
//     }
//     java.stdin.end();
//   });
// });


const crypto = require("crypto");

// app.post("/run-java", (req, res) => {
//   const { code, input } = req.body;
//   if (!code) return res.status(400).json({ error: "No code provided" });

//   // Extract public class name
//   const match = code.match(/public\s+class\s+(\w+)/);
//   if (!match) return res.status(400).json({ error: "No public class found" });

//   const className = match[1];

//   // Hash the code to identify cache
//   const hash = crypto.createHash("md5").update(code).digest("hex");
//   const cacheDir = path.join(__dirname, "java_cache", hash);
//   const javaFile = path.join(cacheDir, `${className}.java`);
//   const classFile = path.join(cacheDir, `${className}.class`);

//   // Ensure cache directory exists
//   fs.mkdirSync(cacheDir, { recursive: true });

//   // Save code to file (overwrite if needed)
//   fs.writeFileSync(javaFile, code);

//   const compileStart = process.hrtime.bigint();

//   // Check cache: if .class file exists, skip compilation
//   if (fs.existsSync(classFile)) {
//     runJava();
//   } else {
//     const javac = spawn("javac", [javaFile]);

//     let compileError = "";

//     javac.stderr.on("data", (data) => {
//       compileError += data.toString();
//     });

//     javac.on("close", (compileCode) => {
//       const compileEnd = process.hrtime.bigint();
//       const compileTimeMs = Number(compileEnd - compileStart) / 1e6; // ms

//       if (compileCode !== 0) {
//         return res.json({
//           error: "Compilation Error",
//           details: compileError.trim(),
//           compileTimeMs: Math.round(compileTimeMs),
//         });
//       }

//       runJava(Math.round(compileTimeMs));
//     });
//   }

//   function runJava(compileTimeMs = 0) {
//     const execStart = process.hrtime.bigint();
//     const java = spawn("java", ["-cp", cacheDir, className]);

//     let output = "";
//     let runtimeError = "";

//     java.stdout.on("data", (data) => {
//       output += data.toString();
//     });

//     java.stderr.on("data", (data) => {
//       runtimeError += data.toString();
//     });

//     java.on("close", (exitCode) => {
//       const execEnd = process.hrtime.bigint();
//       const execTimeMs = Number(execEnd - execStart) / 1e6;

//       const timeBytes = Math.round(execTimeMs); // ms
//       const memBytes = Math.round(process.memoryUsage().rss / 1024); // KB

//       if (exitCode !== 0) {
//         return res.json({
//           error: "Runtime Error",
//           details: runtimeError.trim(),
//           compileTimeMs,
//           execTimeMs: Math.round(execTimeMs),
//           memBytes,
//           timeBytes,
//         });
//       }

//       res.json({
//         output: output.trim(),
//         compileTimeMs,
//         execTimeMs: Math.round(execTimeMs),
//         memBytes,
//         timeBytes,
//         cached: fs.existsSync(classFile), // 👈 tells if cache was used
//       });
//     });

//     if (input) {
//       java.stdin.write(input + "\n");
//     }
//     java.stdin.end();
//   }
// });

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
// give Cache a time to live of 2 minutes
const CACHE_TTL_MS_SHORT = 2 * 60 * 1000; // 2 minutes

// --- Cache helpers ---
function cleanupCache(cacheRoot, maxAgeMs) {
  if (!fs.existsSync(cacheRoot)) return;
  const now = Date.now();

  fs.readdirSync(cacheRoot).forEach(folder => {
    const folderPath = path.join(cacheRoot, folder);
    const lastUsedFile = path.join(folderPath, ".lastused");
    console.log("Checking cache folder:", folderPath);
    console.log("Last used file:", lastUsedFile);
    

    let lastUsed = 0;
    if (fs.existsSync(lastUsedFile)) {
      lastUsed = parseInt(fs.readFileSync(lastUsedFile, "utf8"), 10);
    }
    console.log("Last used timestamp:", lastUsed);
    console.log("Current time:", now);
    console.log("Max age (ms):", maxAgeMs);
    console.log("Age (ms):", now - lastUsed);
    
    if (!lastUsed || now - lastUsed > maxAgeMs) {
      console.log("🗑️ Cleaning old cache:", folderPath);
      fs.rmSync(folderPath, { recursive: true, force: true });
    }
  });
}

function touchCache(folder) {
  fs.writeFileSync(path.join(folder, ".lastused"), Date.now().toString());
}

// --- Java route ---
app.post("/run-java", authMiddleware, (req, res) => {
  const { code, input } = req.body;
  if (!code) return res.status(400).json({ error: "No code provided" });

  const match = code.match(/public\s+class\s+(\w+)/);
  if (!match) return res.status(400).json({ error: "No public class found" });

  const className = match[1];

  // Hash the code to identify cache
  const hash = crypto.createHash("md5").update(code).digest("hex");
  const cacheDir = path.join(__dirname, "java_cache", hash);
  const javaFile = path.join(cacheDir, `${className}.java`);
  const classFile = path.join(cacheDir, `${className}.class`);

  // Cleanup old cache (older than 1 day)
  cleanupCache(path.join(__dirname, "java_cache"), CACHE_TTL_MS_SHORT);
  console.log("Cache dir:", cacheDir);
  // display all the files/folder under /usr/src/app/java_cache
  console.log("Cache root contents:", fs.existsSync(path.join(__dirname, "java_cache")) ? fs.readdirSync(path.join(__dirname, "java_cache")) : "No cache root");
  
  // Ensure cache directory exists
  fs.mkdirSync(cacheDir, { recursive: true });

    // Touch cache to mark it as recently used
  touchCache(cacheDir);
  // Save code to file
  fs.writeFileSync(javaFile, code);

  const compileStart = process.hrtime.bigint();

  // Check cache: skip compilation if .class exists
  if (fs.existsSync(classFile)) {
    runJava();
  } else {
    const javac = spawn("javac", [javaFile]);

    let compileError = "";

    javac.stderr.on("data", (data) => {
      compileError += data.toString();
    });

    javac.on("close", (compileCode) => {
      const compileEnd = process.hrtime.bigint();
      const compileTimeMs = Number(compileEnd - compileStart) / 1e6;

      if (compileCode !== 0) {
        return res.json({
          error: "Compilation Error",
          details: compileError.trim(),
          compileTimeMs: Math.round(compileTimeMs),
        });
      }

      runJava(Math.round(compileTimeMs));
    });
  }

  function runJava(compileTimeMs = 0) {
    const execStart = process.hrtime.bigint();
    const java = spawn("java", ["-cp", cacheDir, className]);

    let output = "";
    let runtimeError = "";

    java.stdout.on("data", (data) => {
      output += data.toString();
    });

    java.stderr.on("data", (data) => {
      runtimeError += data.toString();
    });

    java.on("close", (exitCode) => {
      const execEnd = process.hrtime.bigint();
      const execTimeMs = Number(execEnd - execStart) / 1e6;

      const timeBytes = Math.round(execTimeMs);
      const memBytes = Math.round(process.memoryUsage().rss / 1024);

      if (exitCode !== 0) {
        return res.json({
          error: "Runtime Error",
          details: runtimeError.trim(),
          compileTimeMs,
          execTimeMs: Math.round(execTimeMs),
          memBytes,
          timeBytes,
        });
      }

      res.json({
        output: output.trim(),
        compileTimeMs,
        execTimeMs: Math.round(execTimeMs),
        memBytes,
        timeBytes,
        cached: fs.existsSync(classFile),
      });
    });

    if (input) java.stdin.write(input + "\n");
    java.stdin.end();
  }
});


// app.post("/run-csharp", (req, res) => {
//   const { code, input } = req.body;
//   if (!code) return res.status(400).json({ error: "No code provided" });

//   const projDir = path.join(__dirname, "csproj");
//   const projFile = path.join(projDir, "csproj.csproj");
//   const csFile = path.join(projDir, "Program.cs");

//   // Ensure project exists
//   if (!fs.existsSync(projFile)) {
//     // Create new console project
//     spawnSync("dotnet", ["new", "console", "-n", "csproj", "-o", projDir], {
//       stdio: "inherit"
//     });
//   }

//   // Overwrite Program.cs with user code
//   fs.writeFileSync(csFile, code);

//   // Start measuring time
//   const startTime = process.hrtime.bigint();

//   // Run project
//   // const run = spawn("dotnet", ["run", "--project", projDir]);
//   const run = spawn("dotnet", ["run", "--project", projDir, "-nowarn:CS8600"]);

//   let output = "";
//   let runtimeError = "";

//   run.stdout.on("data", (data) => {
//     output += data.toString();
//     output = output
//       .split("\n")
//       .filter(line => !line.includes("warning CS"))
//       .join("\n");
//   });

//   run.stderr.on("data", (data) => {
//     runtimeError += data.toString();
//   });

//   run.on("close", (exitCode) => {
//     const endTime = process.hrtime.bigint();
//     const timeMs = Number(endTime - startTime) / 1e6;

//     const timeBytes = Math.round(timeMs);
//     const memBytes = Math.round(process.memoryUsage().rss / 1024);

//     if (exitCode !== 0) {
//       return res.json({
//         error: "Runtime Error",
//         details: runtimeError.trim(),
//         memBytes,
//         timeBytes,
//       });
//     }

//     res.json({
//       output: output.trim(),
//       memBytes,
//       timeBytes,
//     });
//   });

//   // Pass input if provided
//   if (input) {
//     run.stdin.write(input + "\n");
//   }
//   run.stdin.end();
// });

app.post("/run-csharp", authMiddleware, (req, res) => {
  const { code, input } = req.body;
  if (!code) return res.status(400).json({ error: "No code provided" });

  // Hash code for cache dir
  const hash = crypto.createHash("md5").update(code).digest("hex");
  const cacheDir = path.join(__dirname, "csharp_cache", hash);
  const projFile = path.join(cacheDir, "app.csproj");
  const csFile = path.join(cacheDir, "Program.cs");
  const dllFile = path.join(cacheDir, "bin", "Debug", "net6.0", "app.dll");

  // Cleanup old cache (older than 1 day, or shorter for testing)
  cleanupCache(path.join(__dirname, "csharp_cache"), CACHE_TTL_MS_SHORT);
  console.log("Cache dir:", cacheDir);
  console.log("Cache root contents:", fs.existsSync(path.join(__dirname, "csharp_cache")) ? fs.readdirSync(path.join(__dirname, "csharp_cache")) : "No cache root");

  // Ensure cache dir exists
  fs.mkdirSync(cacheDir, { recursive: true });

  // Mark cache as recently used
  touchCache(cacheDir);

  // Ensure project exists
  if (!fs.existsSync(projFile)) {
    spawnSync("dotnet", ["new", "console", "-n", "app", "-o", cacheDir], {
      stdio: "inherit"
    });
  }

  // Write user code
  fs.writeFileSync(csFile, code);

  const compileStart = process.hrtime.bigint();

  // If DLL exists, skip compilation
  if (fs.existsSync(dllFile)) {
    runCSharp();
  } else {
    const build = spawn("dotnet", ["build", cacheDir, "-nowarn:CS8600"]);

    let buildError = "";
    build.stderr.on("data", (data) => {
      buildError += data.toString();
    });

    build.on("close", (buildCode) => {
      const compileEnd = process.hrtime.bigint();
      const compileTimeMs = Number(compileEnd - compileStart) / 1e6;

      if (buildCode !== 0) {
        return res.json({
          error: "Compilation Error",
          details: buildError.trim(),
          compileTimeMs: Math.round(compileTimeMs),
        });
      }

      runCSharp(Math.round(compileTimeMs));
    });
  }

  function runCSharp(compileTimeMs = 0) {
    const execStart = process.hrtime.bigint();
    const run = spawn("dotnet", [dllFile]);

    let output = "";
    let runtimeError = "";

    run.stdout.on("data", (data) => {
      output += data.toString();
      // filter warnings
      output = output
        .split("\n")
        .filter(line => !line.includes("warning CS"))
        .join("\n");
    });

    run.stderr.on("data", (data) => {
      runtimeError += data.toString();
    });

    run.on("close", (exitCode) => {
      const execEnd = process.hrtime.bigint();
      const execTimeMs = Number(execEnd - execStart) / 1e6;

      const timeBytes = Math.round(execTimeMs);
      const memBytes = Math.round(process.memoryUsage().rss / 1024);

      if (exitCode !== 0) {
        return res.json({
          error: "Runtime Error",
          details: runtimeError.trim(),
          compileTimeMs,
          execTimeMs: Math.round(execTimeMs),
          memBytes,
          timeBytes,
        });
      }

      res.json({
        output: output.trim(),
        compileTimeMs,
        execTimeMs: Math.round(execTimeMs),
        memBytes,
        timeBytes,
        cached: fs.existsSync(dllFile), // show cache hit
      });
    });

    if (input) run.stdin.write(input + "\n");
    run.stdin.end();
  }
});


app.post("/run-c", authMiddleware, (req, res) => {
  const { code, input } = req.body;
  if (!code) return res.status(400).json({ error: "No code provided" });

  const cFile = path.join(__dirname, "program.c");
  const outFile = path.join(__dirname, "program.out");

  // Save code to file
  fs.writeFileSync(cFile, code);

  // Compile with gcc
  const gcc = spawn("gcc", [cFile, "-o", outFile]);

  let compileError = "";
  gcc.stderr.on("data", (data) => {
    compileError += data.toString();
  });

  gcc.on("close", (compileCode) => {
    if (compileCode !== 0) {
      return res.json({ error: "Compilation Error", details: compileError.trim() });
    }

    // Track start time
    const startTime = process.hrtime.bigint();

    const run = spawn(outFile);

    let output = "";
    let runtimeError = "";

    run.stdout.on("data", (data) => {
      output += data.toString();
    });

    run.stderr.on("data", (data) => {
      runtimeError += data.toString();
    });

    run.on("close", (exitCode) => {
      const endTime = process.hrtime.bigint();
      const timeMs = Number(endTime - startTime) / 1e6;

      const timeBytes = Math.round(timeMs);
      const memBytes = Math.round(process.memoryUsage().rss / 1024);

      if (exitCode !== 0) {
        return res.json({
          error: "Runtime Error",
          details: runtimeError.trim(),
          memBytes,
          timeBytes,
        });
      }

      res.json({
        output: output.trim(),
        memBytes,
        timeBytes,
      });
    });

    // Pass input if provided
    if (input) {
      run.stdin.write(input + "\n");
    }
    run.stdin.end();
  });
});

// --- C++ route ---
app.post("/run-cpp", authMiddleware, (req, res) => {
  const { code, input } = req.body;
  if (!code) return res.status(400).json({ error: "No code provided" });

  const hash = crypto.createHash("md5").update(code).digest("hex");
  const cacheDir = path.join(__dirname, "cpp_cache", hash);
  const cppFile = path.join(cacheDir, "program.cpp");
  const outFile = path.join(cacheDir, "program.out");

  cleanupCache(path.join(__dirname, "cpp_cache"), CACHE_TTL_MS_SHORT);

  fs.mkdirSync(cacheDir, { recursive: true });
  touchCache(cacheDir);
  fs.writeFileSync(cppFile, code);

  const compileStart = process.hrtime.bigint();

  if (fs.existsSync(outFile)) {
    runCpp();
  } else {
    const gpp = spawn("g++", ["-o", outFile, cppFile]);

    let compileError = "";
    gpp.stderr.on("data", (data) => { compileError += data.toString(); });

    gpp.on("close", (compileCode) => {
      const compileEnd = process.hrtime.bigint();
      const compileTimeMs = Number(compileEnd - compileStart) / 1e6;

      if (compileCode !== 0) {
        return res.json({
          error: "Compilation Error",
          details: compileError.trim(),
          compileTimeMs: Math.round(compileTimeMs),
        });
      }
      runCpp(Math.round(compileTimeMs));
    });
  }

  function runCpp(compileTimeMs = 0) {
    const execStart = process.hrtime.bigint();
    const run = spawn(outFile);

    let output = "";
    let runtimeError = "";

    run.stdout.on("data", (data) => { output += data.toString(); });
    run.stderr.on("data", (data) => { runtimeError += data.toString(); });

    run.on("close", (exitCode) => {
      const execEnd = process.hrtime.bigint();
      const execTimeMs = Number(execEnd - execStart) / 1e6;

      const timeBytes = Math.round(execTimeMs);
      const memBytes = Math.round(process.memoryUsage().rss / 1024);

      if (exitCode !== 0) {
        return res.json({
          error: "Runtime Error",
          details: runtimeError.trim(),
          compileTimeMs,
          execTimeMs: Math.round(execTimeMs),
          memBytes,
          timeBytes,
        });
      }

      res.json({
        output: output.trim(),
        compileTimeMs,
        execTimeMs: Math.round(execTimeMs),
        memBytes,
        timeBytes,
        cached: fs.existsSync(outFile),
      });
    });

    if (input) run.stdin.write(input + "\n");
    run.stdin.end();
  }
});

app.post("/run-python", authMiddleware, (req, res) => {
  const { code, input } = req.body;
  if (!code) return res.status(400).json({ error: "No code provided" });
  const pyFile = path.join(__dirname, "script.py");
  fs.writeFileSync(pyFile, code);
  const startTime = process.hrtime.bigint();
  const py = spawn("python", [pyFile]);
  let output = "";
  let runtimeError = "";
  py.stdout.on("data", (data) => {
    output += data.toString();
  });
  py.stderr.on("data", (data) => {
    runtimeError += data.toString();
  });
  py.on("close", (exitCode) => {
    const endTime = process.hrtime.bigint();
    const timeMs = Number(endTime - startTime) / 1e6;
    const timeBytes = Math.round(timeMs);
    const memBytes = Math.round(process.memoryUsage().rss / 1024);
    if (exitCode !== 0) {
      return res.json({
        error: "Runtime Error",
        details: runtimeError.trim(),
        memBytes,
        timeBytes,
      });
    }
    res.json({
      output: output.trim(),
      memBytes,
      timeBytes,
    });
  });
  if (input) {
    py.stdin.write(input + "\n");
  }
  py.stdin.end();
});


// endpoint to get all sessions from MongoDB

// app.post("/run-python", (req, res) => {
//   const { code, input } = req.body;
//   if (!code) return res.status(400).json({ error: "No code provided" });

//   // Hash the code for caching
//   const hash = crypto.createHash("md5").update(code).digest("hex");
//   const cacheDir = path.join(__dirname, "python_cache", hash);
//   const scriptFile = path.join(cacheDir, "main.py");

//   // Cleanup old cache
//   cleanupCache(path.join(__dirname, "python_cache"), CACHE_TTL_MS_SHORT);

//   // Ensure cache directory exists
//   fs.mkdirSync(cacheDir, { recursive: true });

//   // Touch cache folder
//   touchCache(cacheDir);

//   // Save code
//   fs.writeFileSync(scriptFile, code);

//   runPython();

//   function runPython() {
//     const execStart = process.hrtime.bigint();
//     const py = spawn("python3", [scriptFile]);

//     let output = "";
//     let runtimeError = "";

//     py.stdout.on("data", (data) => {
//       output += data.toString();
//     });

//     py.stderr.on("data", (data) => {
//       runtimeError += data.toString();
//     });

//     py.on("close", (exitCode) => {
//       const execEnd = process.hrtime.bigint();
//       const execTimeMs = Number(execEnd - execStart) / 1e6;

//       const timeBytes = Math.round(execTimeMs);
//       const memBytes = Math.round(process.memoryUsage().rss / 1024);

//       if (exitCode !== 0) {
//         return res.json({
//           error: "Runtime Error",
//           details: runtimeError.trim(),
//           execTimeMs: Math.round(execTimeMs),
//           memBytes,
//           timeBytes,
//         });
//       }

//       res.json({
//         output: output.trim(),
//         execTimeMs: Math.round(execTimeMs),
//         memBytes,
//         timeBytes,
//       });
//     });

//     if (input) py.stdin.write(input + "\n");
//     py.stdin.end();
//   }
// });

app.get("/models", (_req, res) => {
    res.status(200).json(AVAILABLE_MODELS);
});

app.get("/sessions", authMiddleware, async (req, res) => {
    try {
  const client = new MongoClient(process.env.MONGO_URI);
  const dbName = "aiMemoryDB";
  const collectionName = "sessions";
  
  async function connectDB() {
    if (!client.topology || !client.topology.isConnected()) {
      await client.connect();
    }
    return client.db(dbName).collection(collectionName);
  }
  const collection = await connectDB();
  // Scope sessions to the authenticated user
  const sessions = await collection.find({ createdBy: req.user.username }).sort({ lastActive: -1 }).toArray();
  res.json({ sessions });

    } catch (error) {
        console.error("Error in /sessions:", error);
        return res.status(500).send({ error: "Internal server error." });
    }
});

// endpoint to get all records of a session with role assistant from MongoDB
app.get("/conversations/:sessionId", authMiddleware, async (req, res) => {
    try {
  const client = new MongoClient(process.env.MONGO_URI);
  const dbName = "aiMemoryDB";
  const collectionName = "conversations";
  const sessionId = req.params.sessionId; 
  async function connectDB() {
    if (!client.topology || !client.topology.isConnected()) {
      await client.connect();
    }
    return client.db(dbName).collection(collectionName);
  }
  const collection = await connectDB();
  const conversations = await collection.find({ sessionId, role: "assistant" }).toArray();
  res.json({ conversations });
    } catch (error) {
        console.error("Error in /conversations/:sessionId:", error);
        return res.status(500).send({ error: "Internal server error." });
    }
});





// app.post("/run-code",async (req, res) => {
//     await runCode(req.body)
//         .then((response) => {
//             console.log(response);
//             res.status(200).send({ response });
//         })
//         .catch((error) => {
//             console.error("Error in /run-code:", error);
//             res.status(500).send({ error: "Internal server error." });
//         });
// });

app.post('/fetch-qbs', authMiddleware, async (req, res) => {
    const authToken = req.body.authToken || req.query.authToken;

    if (!authToken) return res.status(400).send('Auth token is required');

    try {
        const response = await axios.post('https://api.examly.io/api/v2/questionbanks',
            {
                "branch_id": "all",
                "search": `${req.body.search || ''}`,
                "limit": 5000,
                "page": 1,
                "visibility": "All",
                "mainDepartmentUser": true,
                "department_id": [
                    "617346bd-b9c8-468d-9099-12170fb3b570",
                    "8c9bb195-1e81-4506-bc39-c48e6450c2a0",
                    "58efa904-a695-4c14-8335-124c9ec5e95a",
                    "4b375029-26ec-4d20-bf46-1122dfc584ae",
                    "d40c4d09-8ac5-4a26-b969-ce9cc8685180",
                    "e0f02ce1-486b-4122-8f1b-d80f7076bee3",
                    "04c14795-d8b2-41c0-9c41-997a5630f455",
                    "074cbc54-a20f-4a5d-9c02-1ca6a1bed28f",
                    "da3f5269-34b1-49c4-8d38-30c18b4f6598",
                    "f04c0f04-f6d7-434d-b8c9-5c356805ffab",
                    "f0b8af1b-288a-4b41-97b1-27447014ada3",
                    "2b60843d-7972-4235-82cb-0ebc33d75d63",
                    "78b66861-c946-4d83-9754-75c32925b5a9",
                    "5d1e18e7-b9aa-4d43-93b3-eb0a7a3df0d6",
                    "82208516-6d07-4fc0-8ee4-4205601c6695",
                    "b55a5b74-7f4a-428e-a59b-377dd8c7e4ba",
                    "35700f99-19f6-42c2-a336-d32687690e4a",
                    "c47b433a-7f1d-4014-a5b9-415187ed118b",
                    "fb751a89-c97a-47a6-9795-a33b3ba2eede",
                    "c02099c7-354a-48a9-867c-91cd16c6de38",
                    "4bb74161-364a-4012-9122-be5597db9f9e",
                    "a9ac9b80-daf9-45c3-aa4e-3aecd0a3820b",
                    "91f6683d-2512-416a-a355-2c6eefe9507b",
                    "6aa4e718-9fd9-4911-85c0-b900eed73547",
                    "2d24fa30-2621-418b-9597-0442ff8997df",
                    "5d4d3d63-73cd-4b04-a579-6c4f9fdf7473",
                    "55faaca8-4375-4bc6-874e-740dbf3dd22e",
                    "e100cac4-4586-4f3a-b598-24ee8d6c7a92",
                    "ffa1501f-1747-4ea7-9b83-22b3ab409d51",
                    "97c0a54a-67d2-4bc6-87b6-74b369e15889",
                    "627f1e5a-3e5e-4e14-b948-eab0baf714c4",
                    "d7d9bd6a-7bdc-46aa-8929-458e674f94c5",
                    "c3d1f72d-aa83-4276-9976-c5fcb06f70f8",
                    "4bf536a6-a9fa-4215-a803-056f0074e3e7",
                    "2680fe23-89dc-4035-a7a6-eb1869630f81",
                    "1dce25ce-cb7a-4826-a7e4-ab4c189bf436",
                    "e641144f-f801-4f79-8f3b-cff27ab3a123",
                    "7296cb61-76ce-4064-8928-328f2a545666",
                    "48942306-1e80-4db5-bd3b-e3075202d9b8",
                    "0ba8c5fa-9754-4d7f-851a-aa4791b9b445",
                    "8b0329c3-626e-4644-b6f4-dcb0424ed9fa",
                    "969b5384-e5ac-46aa-996b-547e5c77c3bf",
                    "41b64d5f-bb55-47a7-ad77-208e27ccae80",
                    "0400731b-2ab3-4644-828e-7c1618b23aac",
                    "e024b5b6-d6db-4fe6-a445-8b49facf10bb",
                    "d5c3f38f-fc70-4ac8-af83-372cd006396f",
                    "09f0cbe3-5c20-4c75-9c50-b4ee6fa6d09a",
                    "8154bcaa-3ee6-423f-938e-e4ccfe6002a7",
                    "4d037902-f46b-4fcf-824a-8f65376dbdcc",
                    "4ced5ede-47de-42b8-a5e3-a5af9d0ce415",
                    "566994d3-6a6f-4174-899a-700468f4bc7a",
                    "ebd40260-e32b-4367-8b8f-c606793e423b",
                    "6adf26cd-4949-4501-99c4-336401d84b49",
                    "64195871-472d-4520-839b-be0b8cbf2a94",
                    "4af00c09-f6a8-4099-8699-1c6a57db677b",
                    "0eb0005e-01b2-412a-a325-d0ea0ab9d64c",
                    "282bae70-ecb4-469a-94d0-8df0917b6ed4",
                    "62024afb-ea1e-4a6b-ad01-cbf1e592ed3c",
                    "662bd1f5-9c20-411a-aad0-e00e1881a6f2",
                    "54d15165-fc20-4e2e-bc1a-19e46c6a6f30",
                    "3f3711bd-ba73-404a-b72a-dee82166d2b4",
                    "a17c1837-80dd-4d0f-9a05-629e8f00eeb5",
                    "617ce4f5-33ec-4ff6-b1a6-1c74220be379",
                    "bf6ce3d6-8552-4959-bc65-9068c8f7738b",
                    "3f0fd32e-4290-488f-8e93-ba49d4dc1ecd",
                    "51827123-a24e-4aac-a23b-cbf3b95177e5",
                    "7a309bfc-d490-4269-8c36-f2899e02de65",
                    "9a64ffc7-47af-4f28-8dfa-31718a16ea7b",
                    "bd3777c4-635f-435a-94da-3426f786d592",
                    "6204bdfd-9a00-42b5-b951-0ab9a7a22105",
                    "173df851-7e75-43f1-9185-19028621a66f",
                    "e9fecb8e-8553-4d23-ac96-eca3da15af90",
                    "8eeae087-ce46-4d8a-9d0d-aefef190f0cd",
                    "00522911-f5fa-48fd-acb2-333b40117b82",
                    "41698284-bb61-4f6c-aaf1-591182d9025d",
                    "901ff1b8-cc03-4bb3-96b9-42bb53e86701",
                    "5c490195-95f7-4577-a9cb-3096d940af5d",
                    "1b18fbbf-a4ca-45df-ab78-75480a154b4a",
                    "ef6771c4-b9f5-4593-b4f6-ae9cd8845ec2",
                    "b073f250-c7eb-4d6b-829e-3af6ceb94037",
                    "78dc3377-b4a2-4338-b17e-6d8dde7cfeb1",
                    "ba75398b-44ce-487a-9dcd-f57339241e8d",
                    "a09496c9-0412-4649-944f-2edca43cb252",
                    "756c5ccf-535e-4b26-8d5f-3acc607e9a81",
                    "34c1f447-25af-4a75-9abf-be10d1626076",
                    "82156a68-a333-4217-8ac6-4863dd04d457",
                    "e329730f-6efb-47d0-a86c-04e764487a28",
                    "47e36ac4-0185-41c2-992c-d18c57d4a331",
                    "9783c0ce-d618-4909-adf9-79b2c9d2f10e",
                    "55cd2a51-53b1-47a3-9869-56e3d6bba559",
                    "c5758329-0590-4b1f-8447-f64d20c21b96",
                    "1abc3b49-cb7a-4d1d-a507-69fd139e57ae",
                    "61164b98-a492-4009-b2a9-9c94f01ef8a8",
                    "f650e3df-80fa-4e27-b254-3dd802a071a7",
                    "015b365f-9bcd-41c4-92fd-9e3e475cbdac",
                    "281d8e09-ea24-4aee-9d62-bb945c33fc7a",
                    "9f1b6c5b-ff23-4c7e-b3e6-576f36f893d5",
                    "3610abcc-b6f4-4a8e-b593-77c165755778",
                    "9697e209-d83d-41f3-a51b-8de4de0bbe54",
                    "9a4a2f10-f5bd-420f-a71c-3e25f70c2ceb",
                    "cfeff396-511e-472b-bd3f-288dff86a343",
                    "151656b3-5b14-4397-a293-8c8962ef1075",
                    "c8f816f8-836d-4fe6-9ad6-d48fe5fd372d",
                    "5473cf88-4fca-4b1c-a978-b1c25589654c",
                    "b7ec2e38-e5e8-44f1-9427-229b4c15c443",
                    "8f5f4ff5-6322-414f-a26d-38a2ebaaaf58",
                    "ad35005d-9bb8-4e59-8df6-c4a164d4be1f",
                    "9c95a180-5ae6-4109-b5bf-ca28b3f45c53",
                    "c1323b4a-12ec-4906-86d2-fcbc4cc261be",
                    "5eba9f0f-94be-45c5-b811-b351b9e81a2d",
                    "d4dee91f-ee3f-4153-a78f-2114bf3e5b56",
                    "b5c43777-62fb-4841-8044-df9635e168a5",
                    "b55f9101-3379-4f7d-8ee5-be8c4662b73d",
                    "705909cd-368f-4d89-8bc4-b88e545448aa",
                    "6591339a-64fd-419b-82a2-01b4198184f7",
                    "e9280c07-148f-4634-86fd-566e2b99ca95",
                    "7ce72cef-ca43-47b2-ab98-b98e08c3fd86",
                    "48a4f5de-81d3-414d-95c7-b5697e4ec0c7",
                    "cb36e5e9-8a8e-4986-9a66-f5f42449042c",
                    "c7952fcf-7717-455a-bde4-c91cb60049af",
                    "e57f0a5b-0175-4515-afdc-03b328c10d67",
                    "b2fa115a-7a45-44da-801c-db58b8bca7fc",
                    "7ef066c2-1ec3-4d01-bc63-9bb6656db39d",
                    "2bdda40a-c0bd-45df-8a82-746c2b20b2da",
                    "bacc7663-1f43-42f6-b8dc-4c66acb4297b",
                    "27f62bde-822a-4c0f-ad8e-045040b8e934",
                    "31ae9c6f-27fe-4663-9990-73386e96629a",
                    "8505dbb5-5f20-4ecd-8f48-7420ae03f534",
                    "c2115608-5c5e-43bb-81ed-bcbe6abd5ea4",
                    "a7cf5456-3f82-4806-bf09-6f44e1fcab21",
                    "135950e9-d50e-46e0-bd83-672abdd75a44",
                    "e7ff788f-c169-4912-becc-922f60c22f33",
                    "1eb3f9be-949f-4366-93ff-38e8bc294204",
                    "8ce00f56-d771-4022-9db3-9cce403018bb",
                    "828a7982-06ea-42e9-ab66-49d479b74a1b",
                    "5c7faff9-4310-4052-9436-87fc02c0c8c7",
                    "02ff769d-0bdc-4b25-9598-6dd51ece3f94",
                    "b2a160ce-3c07-4f76-9141-9b183c1bc6d8",
                    "fde42d90-8163-479c-a4ab-fde8215ad22f",
                    "061912a6-6a43-4ace-b2a0-148ced4eb965",
                    "86430ada-0377-4cc9-9d1c-457928599f80",
                    "607bcef9-d910-4aac-b8dd-9db51424b370",
                    "072ec628-8569-43b3-a232-b5048398bbb3",
                    "3127e585-28e1-4140-8322-4081a22bb52b",
                    "3b13d51e-8e1e-47be-97ed-0801312ebf5f",
                    "ea34c967-7202-493f-ac56-c79ae79e06c5",
                    "55e39f8a-919f-4da6-a1e3-a700cef45cf2",
                    "cef01ce9-8b8a-494e-a0f5-2c56925fb7bf",
                    "f03e4d7d-ab35-4164-a9e8-580fce7acc1f",
                    "dc8f9b62-4920-4405-90d9-4debfa298549",
                    "05542ae9-203f-48cb-8090-01409d1415e7",
                    "720ce887-66da-4927-ad6a-ab9c07aa9492",
                    "497de26c-ecf6-4734-aac8-86e87e75daa5",               
                    "df128e4a-e75e-426e-9d59-bff816f08a72",
                    "988be022-e14d-4662-99c0-8bef716fc826",
                    "a6d5352b-4eba-4eab-9d42-53be25022198",
                    "09abbbe9-f2f3-4503-aa43-f0785059b0d2",
                    "6610561a-f5b2-433c-8dcd-5902a1f71dc8",
                    "efa47177-57a4-4b22-9414-d4982a59a3a1",
                    "b436748f-f22a-41bb-a760-ae12d76b74a4",
                    "59283fa5-e3c5-43d9-9249-c608ce678da0",
                    "a2be84c8-7478-465e-b6d0-ce866779fc91",
                    "bf7c065e-8d55-4bed-8acb-af1a95921c57",
                    "65dea691-1760-44b9-8fa5-d2250d42493b",
                    "dd364bb3-7c10-4241-9557-80e002b0001a",
                    "19f0d0ea-714e-4de4-b1e8-527e79620893",
                    "531a1b18-362d-4868-a3c7-8d40358afed9",
                    "e999c4b1-bfe3-4369-b2bf-5ef3458efe94",
                    "c5dd9953-15fd-45bb-bec8-f252bf2a89d2",
                    "01b622fd-a74c-49f0-ae35-66bfb6eef5ab",
                    "69605d3b-2b06-4da6-8836-ab59ce6844f3",
                    "b1909585-e394-414e-b5bd-25101ab81c84",
                    "955329cb-2d14-4ca4-b665-b1a2a0d5d000",
                    "02aaaf75-d6ed-422e-a3e3-bf1889c1b9ae",
                    "3151c244-771f-41db-9443-486bde24442c",
                    "a6e2f79e-4ff9-4511-a5b8-af62afb2c02e",
                    "3ae4ebd3-70bb-4a55-8a42-f7e655fe2e2f",
                    "7ac25507-e0b0-473b-a06f-d6093f1f2e41",
                    "c1606ab4-a275-4108-b603-208742aeda77",
                    "28ab722d-201b-4ae8-a2a6-fe690b13572f",
                    "45ac9dcd-9586-4f0a-a48a-6d23f6a7792a",
                    "c799f089-a321-47e5-8c24-dcf3dbda2e31",
                    "6ab5f6f2-d474-4d75-b3f2-2cde376b9227",
                    "c80b12a2-cccb-4040-86e3-9801ab28d422",
                    "132c6552-4768-42db-b46f-db52a5ea0cf4",
                    "2d85cfc2-5760-4588-b581-50d4f88b17bd",
                    "a0dbfb8e-fdf4-4181-a03e-a63e743b6844",
                    "b7372175-e687-4dd0-a3fb-09dfbb962a3e"
                ]
            },
            {  headers: {
                "Authorization": authToken,
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
        });
        const qbs = response.data;
        res.json(qbs);
    } catch (error) {
        console.error('Error fetching QBs:', error?.response?.data || error);
        res.status(500).send('An error occurred while fetching QBs');
    }
});



/**
 * POST /generate-batch
 * Full pipeline: generate N problems → solutions → auto-validate each.
 *
 * Request body:
 *   { count, language, topic, difficulty_level, format, sessionId, prompt, autoValidate }
 *
 * Response:
 *   {
 *     sessionId,
 *     count,
 *     results: [
 *       {
 *         problem: { question_data, inputformat, outputformat, manual_difficulty, language },
 *         solution: { solution_data, samples, io_spec } | null,
 *         validation: { all_passed, passed_count, failed_count, total, results } | null,
 *         status: "valid" | "failed" | "error"
 *       }
 *     ]
 *   }
 */
app.post("/generate-batch", authMiddleware, async (req, res) => {
    try {
        const { count = 1, autoValidate = true, ...codGenParams } = req.body;
        const parsedCount = Math.max(1, parseInt(count) || 1);
        const createdBy = req.user.username;

        // Fetch previously generated scenario summaries for this user to prevent re-generation
        const excludeScenarios = await getGeneratedScenarios({
            generatedBy: createdBy,
            language: codGenParams.language,
        }).catch(() => []);

        // Step 1: Generate N problem descriptions in one LLM call
        const codResult = await aiCODGenerator({ ...codGenParams, count: parsedCount, excludeScenarios, createdBy });
        if (!codResult || !codResult.result || codResult.result.length === 0) {
            return res.status(500).json({ error: "Failed to generate problem descriptions." });
        }

        const problems = codResult.result;
        const batchResults = [];

        // Step 2 & 3: For each problem, generate solution + validate (sequential to avoid rate limits)
        const { provider, model } = codGenParams;
        for (const problem of problems) {
            let solution = null;
            let validation = null;
            let status = "error";

            try {
                const solutionResult = await aiSolutionGenerator({
                    question_data: problem.question_data,
                    inputformat: problem.inputformat,
                    outputformat: problem.outputformat,
                    language: problem.language,
                    manual_difficulty: problem.manual_difficulty,
                    provider,
                    model,
                });

                solution = solutionResult?.[0] || null;

                if (autoValidate && solution) {
                    validation = await validateSolution(
                        solution.solution_data,
                        solution.samples,
                        problem.language,
                        15000
                    );
                    status = validation.all_passed ? "valid" : "failed";
                } else {
                    status = "pending";
                }
            } catch (err) {
                console.error("Error processing problem:", err.message);
                status = "error";
            }

            batchResults.push({ problem, solution, validation, status });
        }

        res.status(200).json({
            sessionId: codResult.sessionId,
            count: batchResults.length,
            results: batchResults,
        });

    } catch (error) {
        console.error("Error in /generate-batch:", error);
        res.status(500).json({ error: "Internal server error.", details: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});




    