const express = require('express');
const axios = require('axios');

const app = express();
const PORT = 3000;

// ==========================================
// CREATOR API CONFIGURATION
// Find this on your Patreon Developer Portal
// ==========================================
const CREATOR_ACCESS_TOKEN = 'REPLACE_WITH_YOUR_CREATORS_ACCESS_TOKEN';

// 1. Backend API Route (Fetches the data from Patreon)
app.get('/api/stats', async (req, res) => {
    try {
        // We use your personal creator token to ask Patreon for campaign stats
        const response = await axios.get('https://www.patreon.com/api/oauth2/v2/campaigns', {
            headers: {
                Authorization: `Bearer ${CREATOR_ACCESS_TOKEN}`
            },
            params: {
                // We ask specifically for the patron count parameter
                'fields[campaign]': 'patron_count,creation_name,summary'
            }
        });

        // Patreon returns an array of campaigns (usually just one)
        const campaignData = response.data.data[0].attributes;

        // Send it back to our frontend as clean JSON
        res.json({
            success: true,
            patrons: campaignData.patron_count,
            name: campaignData.creation_name,
            summary: campaignData.summary
        });

    } catch (error) {
        console.error("Failed to fetch Patreon stats:", error.message);
        res.status(500).json({ success: false, message: "Could not reach Patreon API." });
    }
});

// 2. The Public Web Page
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Live Support Tracker</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #1a1a24; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .widget { background: #252533; padding: 40px; border-radius: 16px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); width: 350px; border-top: 5px solid #ff424d; }
                .count { font-size: 64px; font-weight: bold; color: #ff424d; margin: 10px 0; }
                .label { font-size: 18px; color: #a0a0ab; text-transform: uppercase; letter-spacing: 2px; }
                .pulse { animation: pulse 2s infinite; display: inline-block; width: 12px; height: 12px; background-color: #10b981; border-radius: 50%; margin-right: 8px; }
                @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
            </style>
        </head>
        <body>
            <div class="widget">
                <div style="color: #a0a0ab; font-size: 14px; margin-bottom: 20px;">
                    <span class="pulse"></span> LIVE SERVER TRACKER
                </div>
                <div class="label">Current Active Patrons</div>
                <div class="count" id="patronCount">--</div>
                <p style="color: #a0a0ab; font-size: 14px;">Thank you for supporting the server!</p>
            </div>

            <script>
                // When the page loads, fetch the stats from our own backend route
                async function loadStats() {
                    try {
                        const response = await fetch('/api/stats');
                        const data = await response.json();
                        
                        if(data.success) {
                            // Animate the number counting up
                            let current = 0;
                            const target = data.patrons;
                            const element = document.getElementById('patronCount');
                            
                            const timer = setInterval(() => {
                                current++;
                                element.innerText = current;
                                if(current >= target) clearInterval(timer);
                            }, 50);
                        } else {
                            document.getElementById('patronCount').innerText = "ERR";
                        }
                    } catch(e) {
                        document.getElementById('patronCount').innerText = "OFFLINE";
                    }
                }
                
                loadStats();
                // Refresh data every 60 seconds without reloading the page
                setInterval(loadStats, 60000);
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => console.log(`Live Tracker API running on port ${PORT}`));
