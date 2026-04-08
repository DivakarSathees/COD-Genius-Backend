const fs = require("fs");
const { exec } = require("child_process");
const path = require("path");

function executeJavaCode(javaCode, callback) {
  const fileName = "HelloWorld"; // should match public class name
  const javaFile = path.join(__dirname, `${fileName}.java`);

  // 1. Write code to file
  fs.writeFileSync(javaFile, javaCode);

  // 2. Compile using javac
  exec(`javac ${javaFile}`, (err, stdout, stderr) => {
    if (err) {
      return callback(`Compilation Error:\n${stderr}`);
    }

    // 3. Run the compiled class
    exec(`java -cp ${__dirname} ${fileName}`, (err, stdout, stderr) => {
      if (err) {
        return callback(`Runtime Error:\n${stderr}`);
      }
      callback(stdout);
    });
  });
}

// Example usage
const javaCode = `
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello from Java inside Node!");
    }
}
`;

executeJavaCode(javaCode, (result) => {
  console.log("Output:\n", result);
});
