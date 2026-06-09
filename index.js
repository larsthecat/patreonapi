const express = require("express");
const session = require("express-session");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  session({
    secret:
      process.env.SESSION_SECRET || "change-this-to-a-secure-random-string",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 24 hours
  })
);

// 1. Home Page / Landing Page
app.get("/", (req, res) => {
  res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Creator Premium Portal</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #fafafa; color: #333; margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
                .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); text-align: center; max-width: 400px; width: 100%; }
                h1 { color: #111; font-size: 24px; margin-bottom: 10px; }
                p { color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 30px; }
                .btn-patreon { display: inline-block; background-color: #ff424d; color: white; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 8px; transition: background 0.2s ease; font-size: 15px; }
                .btn-patreon:hover { background-color: #e3353f; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Exclusive Pro Portal 🔒</h1>
                <p>Welcome! This area contains premium content. Please log in with your Patreon account to verify your active subscription tier.</p>
                <a href="/login" class="btn-patreon">Log in with Patreon</a>
            </div>
        </body>
        </html>
    `);
});

// 2. Redirect User to Patreon OAuth2 Authorization Screen
app.get("/login", (req, res) => {
  if (!process.env.PATREON_CLIENT_ID || !process.env.REDIRECT_URI) {
    return res
      .status(500)
      .send(
        "Configuration Error: Missing PATREON_CLIENT_ID or REDIRECT_URI in .env file."
      );
  }

  const patreonAuthUrl =
    `https://www.patreon.com/oauth2/authorize` +
    `?response_type=code` +
    `&client_id=${process.env.PATREON_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}` +
    `&scope=identity%20identity.memberships`;

  res.redirect(patreonAuthUrl);
});

// 3. OAuth2 Callback Endpoint (Processes the login token and handles verification)
app.get("/oauth/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res
      .status(400)
      .send("Authorization code missing from Patreon callback.");
  }

  try {
    // Exchange the temporary code parameter for a permanent access token
    const tokenResponse = await axios.post(
      "https://www.patreon.com/api/oauth2/token",
      null,
      {
        params: {
          grant_type: "authorization_code",
          code: code,
          client_id: process.env.PATREON_CLIENT_ID,
          client_secret: process.env.PATREON_CLIENT_SECRET,
          redirect_uri: process.env.REDIRECT_URI,
        },
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Fetch the user data and their currently active membership tiers
    const userResponse = await axios.get(
      "https://www.patreon.com/api/oauth2/v2/identity",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          include: "memberships.currently_entitled_tiers",
          "fields[member]": "patron_status",
        },
      }
    );

    const userData = userResponse.data;
    const memberships = userData.included || [];
    let hasAccess = false;

    // Loop through memberships to see if they are active and belong to the correct tier ID
    memberships.forEach((member) => {
      if (
        member.type === "member" &&
        member.attributes.patron_status === "active_patron"
      ) {
        const tiers =
          member.relationships?.currently_entitled_tiers?.data || [];
        const matchesTier = tiers.some(
          (tier) => tier.id === process.env.REQUIRED_TIER_ID
        );
        if (matchesTier) {
          hasAccess = true;
        }
      }
    });

    if (hasAccess) {
      // Store authorization status in user session variables
      req.session.isPremium = true;
      res.redirect("/premium");
    } else {
      res.status(403).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Access Denied</title>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #fafafa; color: #333; margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
                        .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); text-align: center; max-width: 450px; width: 100%; }
                        h1 { color: #d9534f; font-size: 24px; margin-bottom: 10px; }
                        p { color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 25px; }
                        .btn-home { display: inline-block; color: #666; text-decoration: underline; font-size: 14px; margin-top: 15px; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h1>Access Denied 🔒</h1>
                        <p>Your Patreon account connected successfully, but you are not actively subscribed to the specific tier required to view this page.</p>
                        <p>Please double check your active subscription on Patreon and try logging in again.</p>
                        <a href="/" class="btn-home">Return to Homepage</a>
                    </div>
                </body>
                </html>
            `);
    }
  } catch (error) {
    console.error(
      "Patreon Auth Error Details:",
      error.response?.data || error.message
    );
    res
      .status(500)
      .send("Authentication process failed. Check server logs for details.");
  }
});

// 4. Premium Protected Content Page Route
app.get("/premium", (req, res) => {
  if (req.session.isPremium) {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vanilla Client PRO+ Dashboard</title>
        <style>
            :root {
                --bg-main: #0f0f12;
                --bg-card: #17171c;
                --bg-input: #1e1e24;
                --accent: #ff2a35;
                --accent-hover: #e01b25;
                --text-main: #f1f1f4;
                --text-muted: #9a9a9b;
                --success: #10b981;
            }
    
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: var(--bg-main);
                color: var(--text-main);
                margin: 0;
                padding: 0;
                display: flex;
                height: 100vh;
                overflow: hidden;
            }
    
            /* Sidebar Navigation */
            .sidebar {
                width: 280px;
                background-color: var(--bg-card);
                border-right: 1px solid #25252b;
                display: flex;
                flex-direction: column;
                height: 100%;
            }
    
            .sidebar-header {
                padding: 20px;
                border-bottom: 1px solid #25252b;
                text-align: center;
            }
    
            .sidebar-header h1 {
                font-size: 20px;
                margin: 0;
                color: #fff;
                letter-spacing: 1px;
            }
    
            .sidebar-header .badge {
                background: linear-gradient(45deg, var(--accent), #ff761b);
                color: white;
                font-size: 11px;
                padding: 2px 8px;
                border-radius: 12px;
                font-weight: bold;
                display: inline-block;
                margin-top: 5px;
            }
    
            .menu-items {
                flex: 1;
                overflow-y: auto;
                padding: 15px 10px;
            }
    
            .menu-btn {
                width: 100%;
                background: none;
                border: none;
                color: #a0a0ab;
                text-align: left;
                padding: 12px 15px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                margin-bottom: 5px;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 10px;
            }
    
            .menu-btn:hover {
                background-color: var(--bg-input);
                color: #fff;
            }
    
            .menu-btn.active {
                background-color: var(--accent);
                color: #fff;
                font-weight: bold;
            }
    
            /* Main Content Workspace */
            .workspace {
                flex: 1;
                padding: 40px;
                overflow-y: auto;
                background: linear-gradient(135deg, #0f0f12 0%, #13131a 100%);
            }
    
            .tool-panel {
                display: none;
                background: var(--bg-card);
                border-radius: 12px;
                padding: 30px;
                box-shadow: 0 8px 30px rgba(0,0,0,0.4);
                border: 1px solid #25252b;
                max-width: 850px;
                animation: fadeIn 0.3s ease;
            }
    
            .tool-panel.active {
                display: block;
            }
    
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
    
            h2 {
                margin-top: 0;
                font-size: 24px;
                color: #fff;
                border-bottom: 1px solid #25252b;
                padding-bottom: 12px;
                margin-bottom: 20px;
            }
    
            p.desc {
                color: #a0a0ab;
                font-size: 14px;
                margin-bottom: 25px;
                line-height: 1.5;
            }
    
            /* Form Components */
            label {
                display: block;
                margin-bottom: 8px;
                font-weight: 600;
                font-size: 14px;
                color: #c5c5d2;
            }
    
            input, select, textarea {
                width: 100%;
                padding: 12px;
                background-color: var(--bg-input);
                border: 1px solid #32323d;
                border-radius: 6px;
                color: #fff;
                font-size: 14px;
                box-sizing: border-box;
                font-family: monospace;
                margin-bottom: 20px;
            }
    
            input:focus, select:focus, textarea:focus {
                border-color: var(--accent);
                outline: none;
            }
    
            .grid-2 {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
            }
    
            button.action-btn {
                background-color: var(--accent);
                color: white;
                border: none;
                padding: 12px 20px;
                font-size: 15px;
                font-weight: bold;
                border-radius: 6px;
                cursor: pointer;
                transition: background 0.2s;
                width: 100%;
            }
    
            button.action-btn:hover {
                background-color: var(--accent-hover);
            }
    
            .output-box {
                background-color: #0b0b0d;
                border-left: 4px solid var(--accent);
                padding: 15px;
                border-radius: 6px;
                font-family: monospace;
                color: #00ff66;
                word-break: break-all;
                white-space: pre-wrap;
                min-height: 30px;
                margin-top: 15px;
            }
        </style>
    </head>
    <body>
    
        <div class="sidebar">
            <div class="sidebar-header">
                <h1>Vanilla Client</h1>
                <span class="badge">PRO+ DASHBOARD</span>
            </div>
            <div class="menu-items">
                <button class="menu-btn active" onclick="switchTool('tool1', this)">1. Version Converter</button>
                <button class="menu-btn" onclick="switchTool('tool2', this)">2. Nether Coordinator</button>
                <button class="menu-btn" onclick="switchTool('tool3', this)">3. Color MOTD Parser</button>
                <button class="menu-btn" onclick="switchTool('tool4', this)">4. Enchantment Generator</button>
                <button class="menu-btn" onclick="switchTool('tool5', this)">5. Stack / Shulker Calculator</button>
                <button class="menu-btn" onclick="switchTool('tool6', this)">6. Custom Item Banner</button>
                <button class="menu-btn" onclick="switchTool('tool7', this)">7. Circle Blueprint Layout</button>
                <button class="menu-btn" onclick="switchTool('tool8', this)">8. Fill Block Volume Tool</button>
                <button class="menu-btn" onclick="switchTool('tool9', this)">9. Attributes & Modifiers</button>
                <button class="menu-btn" onclick="switchTool('tool10', this)">10. XP Level Calculator</button>
                <button class="menu-btn" onclick="switchTool('tool11', this)">11. Color Text Previewer</button>
            </div>
        </div>
    
        <div class="workspace">
    
            <div id="tool1" class="tool-panel active">
                <h2>Tool 1: Command Version Converter</h2>
                <p class="desc">Converts basic structures between legacy /give structure and modern 1.20.5+ Component items.</p>
                <label>Conversion Direction</label>
                <select id="t1Direction">
                    <option value="mToL">Modern (1.20.5+) ➔ Legacy (1.12 - 1.20)</option>
                    <option value="lToM">Legacy (1.12 - 1.20) ➔ Modern (1.20.5+)</option>
                </select>
                <label>Input Command</label>
                <input type="text" id="t1Input" value="/give @p diamond_sword[damage=15] 1">
                <button class="action-btn" onclick="runTool1()">Convert Syntax</button>
                <div class="output-box" id="t1Output">...</div>
            </div>
    
            <div id="tool2" class="tool-panel">
                <h2>Tool 2: Nether Portal Alignment Linker</h2>
                <p class="desc">Maintains safe 8:1 spacing properties across dimension nodes to avoid layout intersection hazards.</p>
                <label>Mapping Rules</label>
                <select id="t2Dir" onchange="document.getElementById('lblX').innerText = this.value==='oToN'?'Overworld X':'Nether X'">
                    <option value="oToN">Overworld Coordinates ➔ Nether Grid</option>
                    <option value="nToO">Nether Grid ➔ Overworld Coordinates</option>
                </select>
                <div class="grid-2">
                    <div><label id="lblX">Overworld X</label><input type="number" id="t2X" value="800"></div>
                    <div><label>Target Z coordinate</label><input type="number" id="t2Z" value="-1600"></div>
                </div>
                <button class="action-btn" onclick="runTool2()">Translate Coordinates</button>
                <div class="output-box" id="t2Output">...</div>
            </div>
    
            <div id="tool3" class="tool-panel">
                <h2>Tool 3: Color MOTD Configurations Code Parser</h2>
                <p class="desc">Formats color patterns down into native JSON setups or Unicode properties.</p>
                <label>Text Input</label>
                <input type="text" id="t3Input" value="&6&lServer &aOnline!">
                <button class="action-btn" onclick="runTool3()">Parse Format Rules</button>
                <div class="output-box" id="t3Output">...</div>
            </div>
    
            <div id="tool4" class="tool-panel">
                <h2>Tool 4: Enchantment Give Engine</h2>
                <p class="desc">Assembles /give strings populated with stacked enchantment properties for rapid custom item configurations.</p>
                <div class="grid-2">
                    <div>
                        <label>Item Target Base</label>
                        <select id="t4Item">
                            <option value="diamond_sword">Diamond Sword</option>
                            <option value="netherite_pickaxe">Netherite Pickaxe</option>
                            <option value="bow">Bow</option>
                        </select>
                    </div>
                    <div>
                        <label>Enchantment Rule</label>
                        <select id="t4Ench">
                            <option value="sharpness">Sharpness</option>
                            <option value="efficiency">Efficiency</option>
                            <option value="unbreaking">Unbreaking</option>
                        </select>
                    </div>
                </div>
                <label>Power Level Integer</label>
                <input type="number" id="t4Lvl" value="5" min="1" max="255">
                <button class="action-btn" onclick="runTool4()">Build Command</button>
                <div class="output-box" id="t4Output">...</div>
            </div>
    
            <div id="tool5" class="tool-panel">
                <h2>Tool 5: Item Stack / Shulker Box Inventory Counter</h2>
                <p class="desc">Converts structural raw items straight into stacks, inventories, and shulker array capacities.</p>
                <label>Total Raw Item Quantities</label>
                <input type="number" id="t5Input" value="5000">
                <button class="action-btn" onclick="runTool5()">Evaluate Volume Profiles</button>
                <div class="output-box" id="t5Output">...</div>
            </div>
    
            <div id="tool6" class="tool-panel">
                <h2>Tool 6: Lore Name Setup Generator</h2>
                <p class="desc">Formats custom JSON styling structures straight down into clean custom named display tags.</p>
                <label>Display Name</label>
                <input type="text" id="t6Name" value="Mythic Blade">
                <label>Color Definition</label>
                <select id="t6Color">
                    <option value="gold">Gold</option>
                    <option value="red">Red</option>
                    <option value="aqua">Aqua</option>
                </select>
                <button class="action-btn" onclick="runTool6()">Generate NBT Display Tag</button>
                <div class="output-box" id="t6Output">...</div>
            </div>
    
            <div id="tool7" class="tool-panel">
                <h2>Tool 7: Circle & Dome Map Blueprint Layout Blueprint Builder</h2>
                <p class="desc">Generates coordinate diameters onto text-based templates for circular structures.</p>
                <label>Circle Target Radius Size</label>
                <input type="number" id="t7Radius" value="5" min="2" max="15">
                <button class="action-btn" onclick="runTool7()">Construct Blueprint Array</button>
                <div class="output-box" id="t7Output" style="line-height:1.2;">...</div>
            </div>
    
            <div id="tool8" class="tool-panel">
                <h2>Tool 8: Fill Block Volume Space Counter</h2>
                <p class="desc">Calculates target box dimensions and aggregate counts to prevent exceeding the 32,768 structural block update constraint.</p>
                <div class="grid-2">
                    <div><label>Dimension Width (ΔX)</label><input type="number" id="t8X" value="10"></div>
                    <div><label>Dimension Height (ΔY)</label><input type="number" id="t8Y" value="5"></div>
                </div>
                <label>Dimension Length (ΔZ)</label>
                <input type="number" id="t8Z" value="12">
                <button class="action-btn" onclick="runTool8()">Test Boundaries</button>
                <div class="output-box" id="t8Output">...</div>
            </div>
    
            <div id="tool9" class="tool-panel">
                <h2>Tool 9: Attribute Modifiers Tag Assembler</h2>
                <p class="desc">Applies modifications directly to entities like maximum health limits or knockback protection parameters.</p>
                <label>Modifier Variable Target</label>
                <select id="t9Attr">
                    <option value="generic.max_health">Max Health Attribute Increase</option>
                    <option value="generic.movement_speed">Movement Speed Factor Modifier</option>
                </select>
                <label>Scaling Multiplier Value</label>
                <input type="number" id="t9Val" value="20">
                <button class="action-btn" onclick="runTool9()">Assemble Tag Setup</button>
                <div class="output-box" id="t9Output">...</div>
            </div>
    
            <div id="tool10" class="tool-panel">
                <h2>Tool 10: XP Level Accumulation Progression Calculator</h2>
                <p class="desc">Calculates exactly how much total points are required to advance safely between target levels.</p>
                <label>Current Character Level</label>
                <input type="number" id="t10Lvl" value="30">
                <button class="action-btn" onclick="runTool10()">Calculate Total Raw Points</button>
                <div class="output-box" id="t10Output">...</div>
            </div>
    
            <div id="tool11" class="tool-panel">
                <h2>Tool 11: Text Layout Live Web Colorizer Tool</h2>
                <p class="desc">Renders terminal color indicators instantly to verify output visual styles accurately.</p>
                <label>Text Field String Editor</label>
                <input type="text" id="t11Input" value="&4&lWarning: &cSystems Overheating!" oninput="runTool11()">
                <label>Live Display Layout Grid</label>
                <div id="t11Output" style="background:#000; padding:15px; border-radius:6px; font-size:18px; font-weight:normal;">...</div>
            </div>
    
        </div>
    
        <script>
            function switchTool(toolId, buttonElement) {
                document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
                document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
                document.getElementById(toolId).classList.add('active');
                buttonElement.classList.add('active');
                
                // Auto initialize specific interactive setups
                if(toolId === 'tool11') runTool11();
            }
    
            function runTool1() {
                let cmd = document.getElementById('t1Input').value;
                let dir = document.getElementById('t1Direction').value;
                let out = document.getElementById('t1Output');
                if(dir === 'mToL') {
                    if(cmd.includes('[') && cmd.includes(']')) {
                        out.innerText = cmd.replace(/\[damage=(\d+)\]/, " 1 $1") + " (Parsed down to Legacy format successfully)";
                    } else { out.innerText = cmd + " (Legacy conversion rules satisfied)"; }
                } else {
                    let parts = cmd.split(" ");
                    if(parts.length >= 4 && !isNaN(parts[parts.length-1])) {
                        let dmg = parts.pop(); let qty = parts.pop(); let item = parts.pop();
                        out.innerText = parts.join(" ") + " " + item + "[damage=" + dmg + "] " + qty;
                    } else { out.innerText = "Syntax layout unvalidated. Ensure input uses sequence: [Item ID] [Count] [Damage]"; }
                }
            }
    
            function runTool2() {
                let dir = document.getElementById('t2Dir').value;
                let x = parseInt(document.getElementById('t2X').value) || 0;
                let z = parseInt(document.getElementById('t2Z').value) || 0;
                if(dir === 'oToN') {
                    document.getElementById('t2Output').innerText = "Nether Axis Target -> X: " + Math.round(x/8) + ", Z: " + Math.round(z/8);
                } else {
                    document.getElementById('t2Output').innerText = "Overworld Axis Target -> X: " + (x*8) + ", Z: " + (z*8);
                }
            }
    
            function runTool3() {
                let val = document.getElementById('t3Input').value;
                document.getElementById('t3Output').innerText = "Legacy Escape Schema: " + val.replace(/&/g, "§") + "\nServer MOTD JSON Syntax: " + val.replace(/&/g, "\\\\u00A0");
            }
    
            function runTool4() {
                let item = document.getElementById('t4Item').value;
                let ench = document.getElementById('t4Ench').value;
                let lvl = document.getElementById('t4Lvl').value;
                document.getElementById('t4Output').innerText = "/give @p " + item + "[enchantments={levels:{\"minecraft:" + ench + "\":" + lvl + "}}] 1";
            }
    
            function runTool5() {
                let total = parseInt(document.getElementById('t5Input').value) || 0;
                let stacks = Math.floor(total / 64);
                let rem = total % 64;
                let shulkers = Math.floor(stacks / 27);
                let remStacks = stacks % 27;
                document.getElementById('t5Output').innerText = shulkers + " Shulker Boxes, " + remStacks + " Stacks, and " + rem + " Items remaining.";
            }
    
            function runTool6() {
                let name = document.getElementById('t6Name').value;
                let color = document.getElementById('t6Color').value;
                document.getElementById('t6Output').innerText = "[display={Name:'{\"text\":\"" + name + "\",\"color\":\"" + color + "\",\"italic\":false}'}]";
            }
    
            function runTool7() {
                let r = parseInt(document.getElementById('t7Radius').value) || 5;
                let canvas = "";
                for (let i = -r; i <= r; i++) {
                    let row = "";
                    for (let j = -r; j <= r; j++) {
                        let dist = Math.sqrt(i*i + j*j);
                        row += (dist > r - 0.5 && dist < r + 0.5) ? "██" : "░░";
                    }
                    canvas += row + "\n";
                }
                document.getElementById('t7Output').innerText = canvas;
            }
    
            function runTool8() {
                let x = Math.abs(parseInt(document.getElementById('t8X').value)) || 1;
                let y = Math.abs(parseInt(document.getElementById('t8Y').value)) || 1;
                let z = Math.abs(parseInt(document.getElementById('t8Z').value)) || 1;
                let total = x * y * z;
                let status = total > 32768 ? "❌ WARNING: Exceeds standard /fill engine bounds!" : "✔ Safe space boundaries verified.";
                document.getElementById('t8Output').innerText = "Total Block Volume Metrics: " + total.toLocaleString() + " units.\n" + status;
            }
    
            function runTool9() {
                let attr = document.getElementById('t9Attr').value;
                let val = document.getElementById('t9Val').value;
                document.getElementById('t9Output').innerText = "[attribute_modifiers=[{type:\"minecraft:" + attr + "\",amount:" + val + ",operation:\"add_value\",uuid:[I;1,2,3,4],name:\"ProModifier\",slot:\"mainhand\"}]]";
            }
    
            function runTool10() {
                let lvl = parseInt(document.getElementById('t10Lvl').value) || 0;
                let xp = 0;
                if (lvl <= 16) xp = (lvl * lvl) + (6 * lvl);
                else if (lvl <= 31) xp = (2.5 * lvl * lvl) - (40.5 * lvl) + 360;
                else xp = (4.5 * lvl * lvl) - (162.5 * lvl) + 2220;
                document.getElementById('t10Output').innerText = "Total accumulated structural XP points required: " + Math.round(xp).toLocaleString() + " Points";
            }
    
            function runTool11() {
                let raw = document.getElementById('t11Input').value;
                let colors = {
                    '0': '#000000', '1': '#0000aa', '2': '#00aa00', '3': '#00aaaa',
                    '4': '#aa0000', '5': '#aa00aa', '6': '#ffaa00', '7': '#aaaaaa',
                    '8': '#555555', '9': '#5555ff', 'a': '#55ff55', 'b': '#55ffff',
                    'c': '#ff5555', 'd': '#ff55ff', 'e': '#ffff55', 'f': '#ffffff'
                };
                
                let html = ""; let currentClose = ""; let isBold = false;
                let parts = raw.split('&');
                
                html += parts[0];
                for(let i=1; i<parts.length; i++) {
                    let chunk = parts[i];
                    if(chunk.length === 0) continue;
                    let code = chunk[0].toLowerCase();
                    let text = chunk.substring(1);
                    
                    if(colors[code]) {
                        if(currentClose) html += currentClose;
                        html += "<span style=\"color:" + colors[code] + ";" + (isBold ? "font-weight:bold;" : "") + "\">";
                        currentClose = "</span>";
                    } else if(code === 'l') {
                        isBold = true;
                        html += "<span style=\"font-weight:bold;\">";
                        currentClose += "</span>";
                    } else if(code === 'r') {
                        if(currentClose) html += currentClose;
                        currentClose = ""; isBold = false;
                    }
                    html += text;
                }
                if(currentClose) html += currentClose;
                document.getElementById('t11Output').innerHTML = html || "&nbsp;";
            }
        </script>
    </body>
    </html>
        `);
  } else {
    res.status(403).send(`
            <div style="font-family: sans-serif; text-align: center; margin-top: 100px;">
                <h2>Unauthorized Access</h2>
                <p>You must log in to view this page. <a href="/login">Click here to log in</a>.</p>
            </div>
        `);
  }
});

app.listen(PORT, () =>
  console.log(`Server successfully started! Running on port ${PORT}`)
);
