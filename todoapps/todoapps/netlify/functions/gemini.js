exports.handler = async function(event, context) {
    // 1. Tolak jika bukan request POST
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    // 2. Ambil API Key yang sudah kamu simpan di dashboard Netlify
    const API_KEY = process.env.GEMINI_API_KEY;

    try {
        // 3. Ambil teks/prompt yang dikirim dari script.js
        const body = JSON.parse(event.body);

        // 4. Proses tembak API ke Google Gemini (aman di belakang server)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify(body) 
        });

        const data = await response.json();

        // 5. Kembalikan jawaban dari AI ke script.js
        return { 
            statusCode: 200, 
            body: JSON.stringify(data) 
        };
        
    } catch (error) {
        console.error(error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: "Gagal terhubung ke AI" }) 
        };
    }
};