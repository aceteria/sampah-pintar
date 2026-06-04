
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const nimUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';

const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const requestBody = {
  model: "meta/llama-3.2-90b-vision-instruct",
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "What is this? Return JSON."
        },
        {
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${base64Data}`
          }
        }
      ]
    }
  ],
  max_tokens: 512
};

console.log('Sending vision request to NIM...');
fetch(nimUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${NVIDIA_API_KEY}`
  },
  body: JSON.stringify(requestBody),
})
.then(async res => {
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response:', text);
})
.catch(err => console.error('Fetch error:', err));


