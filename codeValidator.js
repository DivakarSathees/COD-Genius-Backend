const { executeCode } = require('./codeExecutor');

// Normalize output for comparison: trim + normalize line endings
function normalizeOutput(str) {
  return (str || '').trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Runs solution_data against each sample and compares actual vs expected output.
 * @param {string} solution_data - Complete runnable source code
 * @param {Array}  samples       - Array of { input, output, difficulty, score }
 * @param {string} language      - "Java" | "Python" | "C#" | "C" | "C++" etc.
 * @param {number} timeoutMs     - Per-test-case execution timeout in ms
 * @returns {Promise<object>}    - Validation summary with per-test results
 */
async function validateSolution(solution_data, samples, language, timeoutMs = 10000) {
  const results = [];
  let passedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const execResult = await executeCode(language, solution_data, sample.input, timeoutMs);

    if (execResult.error) {
      failedCount++;
      results.push({
        test_case: i + 1,
        input: sample.input,
        expected_output: sample.output,
        actual_output: null,
        passed: false,
        error: execResult.error,
        error_details: execResult.details || null,
        difficulty: sample.difficulty,
        score: sample.score,
        execTimeMs: execResult.execTimeMs || 0,
        memBytes: execResult.memBytes || 0,
      });
    } else {
      const expected = normalizeOutput(sample.output);
      const actual = normalizeOutput(execResult.output);
      const passed = expected === actual;

      if (passed) passedCount++;
      else failedCount++;

      results.push({
        test_case: i + 1,
        input: sample.input,
        expected_output: sample.output,
        actual_output: execResult.output,
        passed,
        difficulty: sample.difficulty,
        score: sample.score,
        execTimeMs: execResult.execTimeMs || 0,
        memBytes: execResult.memBytes || 0,
      });
    }
  }

  return {
    all_passed: failedCount === 0,
    passed_count: passedCount,
    failed_count: failedCount,
    total: samples.length,
    results,
  };
}

module.exports = { validateSolution };
