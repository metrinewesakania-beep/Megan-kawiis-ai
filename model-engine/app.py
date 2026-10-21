
import os
import torch
from flask import Flask, request, jsonify
from torch import nn

app = Flask(__name__)

MODEL_PATH = os.getenv("MODEL_PATH", "megan_kawiis_1.pt")
device = torch.device("cpu")


class MeganKawiisModel(nn.Module):
    def __init__(self, vocab_size):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, 32)
        self.rnn = nn.GRU(32, 64, batch_first=True)
        self.output = nn.Linear(64, vocab_size)

    def forward(self, x, hidden=None):
        x = self.embedding(x)
        x, hidden = self.rnn(x, hidden)
        return self.output(x), hidden


model = None
characters = []
char_to_id = {}


def load_model():
    global model, characters, char_to_id

    checkpoint = torch.load(
        MODEL_PATH, map_location=device, weights_only=True
    )
    characters = checkpoint["characters"]
    char_to_id = {c: i for i, c in enumerate(characters)}

    model = MeganKawiisModel(len(characters))
    model.load_state_dict(checkpoint["model_state"])
    model.eval()


@app.get("/")
def home():
    return jsonify({
        "name": "Megan Kawiis-1",
        "status": "engine online" if model else "model not loaded"
    })


@app.post("/generate")
def generate():
    if model is None:
        return jsonify({"error": "Model is not loaded"}), 503

    prompt = str(request.json.get("prompt", "Megan"))[:200]
    prompt = "".join(c for c in prompt if c in char_to_id)

    if not prompt:
        prompt = "Megan"

    ids = [char_to_id[c] for c in prompt]
    x = torch.tensor([ids], dtype=torch.long)
    hidden = None

    with torch.no_grad():
        logits, hidden = model(x, hidden)
        generated = prompt

        for _ in range(100):
            probabilities = torch.softmax(logits[0, -1], dim=-1)
            next_id = int(torch.multinomial(probabilities, 1).item())
            generated += characters[next_id]

            x = torch.tensor([[next_id]], dtype=torch.long)
            logits, hidden = model(x, hidden)

            if characters[next_id] == "\n":
                break

    return jsonify({"text": generated})


try:
    load_model()
except Exception as exc:
    print("Model loading failed:", str(exc))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 10000)))
