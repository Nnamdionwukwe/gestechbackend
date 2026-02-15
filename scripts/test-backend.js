// scripts/test-backend.js
const http = require("http");

console.log("🧪 Testing backend connectivity...\n");

// Test 1: Is server running?
console.log("1️⃣ Testing if server is running on port 5000...");
const healthReq = http.get("http://localhost:5000/health", (res) => {
  let data = "";
  res.on("data", (chunk) => {
    data += chunk;
  });
  res.on("end", () => {
    if (res.statusCode === 200) {
      console.log("✅ Server is running!");
      console.log("   Response:", data, "\n");

      // Test 2: Test services endpoint
      console.log("2️⃣ Testing /api/agency/services endpoint...");
      const servicesReq = http.get(
        "http://localhost:5000/api/agency/services",
        (res2) => {
          let data2 = "";
          res2.on("data", (chunk) => {
            data2 += chunk;
          });
          res2.on("end", () => {
            if (res2.statusCode === 200) {
              console.log("✅ Services endpoint works!");
              const parsed = JSON.parse(data2);
              console.log(
                `   Found ${parsed.services?.length || 0} services\n`,
              );
            } else {
              console.log(
                `❌ Services endpoint failed with status ${res2.statusCode}`,
              );
              console.log("   Response:", data2, "\n");
            }
          });
        },
      );

      servicesReq.on("error", (err) => {
        console.log("❌ Services endpoint error:", err.message, "\n");
      });
    } else {
      console.log(`❌ Server responded with status ${res.statusCode}`);
      console.log("   Response:", data, "\n");
    }
  });
});

healthReq.on("error", (err) => {
  console.log("❌ Cannot connect to server!");
  console.log("   Error:", err.message);
  console.log("\n💡 Solution:");
  console.log("   1. Make sure your backend is running: npm run dev");
  console.log("   2. Check that it's running on port 5000");
  console.log(
    "   3. Look for errors in the terminal where backend is running\n",
  );
});
