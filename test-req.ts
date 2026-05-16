import axios from 'axios';

async function run() {
    try {
        const res = await axios.get('http://localhost:3000/api/proxy-sheet?id=1TO0fGH8KaFw0iX-Xn_aFkSLV7O461y_zimoWVByKrjk');
        console.log("STATUS:", res.status);
        console.log("BODY:", res.data);
    } catch (err) {
        console.log("ERROR STATUS:", err.response?.status);
        console.log("ERROR BODY:", err.response?.data);
        console.log("ERROR TEXT:", err.response?.statusText);
        console.log("HEADERS:", err.response?.headers);
    }
}
run();
