"""
Deep Knowledge Tracing (DKT) Service
Wraps the pre-trained BiLSTM model (bilstm_dkt_model.pth).

The model takes a sequence of student interactions and outputs
a mastery probability for the next interaction.

If the model file is missing or PyTorch is unavailable,
falls back to a simple exponential moving average so the
rest of the system continues to work.
"""

import os
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

# Attempt to load PyTorch; graceful fallback if unavailable at runtime
try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("PyTorch not available — DKT will use heuristic fallback.")


# ─── Model Architecture (must match training in notebooks/model_development.ipynb) ───

class BiLSTM_DKT(nn.Module if TORCH_AVAILABLE else object):
    """
    Bidirectional LSTM for Deep Knowledge Tracing.
    Architecture exactly matches the trained checkpoint keys:
      bilstm: LSTM(input=4, hidden=128, layers=2, bidirectional=True)
      fc1: Linear(256, 64)   — 256 = 128 * 2 (bidirectional concat)
      fc2: Linear(64, 1)     — followed by sigmoid in forward()
    """
    def __init__(self, input_size=4, hidden_size=128, num_layers=2, dropout=0.3):
        if TORCH_AVAILABLE:
            super().__init__()
            self.bilstm = nn.LSTM(
                input_size=input_size,
                hidden_size=hidden_size,
                num_layers=num_layers,
                batch_first=True,
                bidirectional=True,
                dropout=dropout if num_layers > 1 else 0,
            )
            self.fc1 = nn.Linear(hidden_size * 2, 64)
            self.fc2 = nn.Linear(64, 1)

    def forward(self, x):
        out, _ = self.bilstm(x)
        last = out[:, -1, :]                     # take final timestep
        hidden = torch.relu(self.fc1(last))
        return torch.sigmoid(self.fc2(hidden))


# ─── DKT Service ─────────────────────────────────────────────────────────────

class DKTService:
    """Singleton wrapper around the trained BiLSTM model."""

    _model: Optional[object] = None
    _loaded: bool = False

    @classmethod
    def load(cls, model_path: Optional[str] = None) -> None:
        if cls._loaded:
            return

        if not TORCH_AVAILABLE:
            cls._loaded = True
            return

        path = model_path or os.getenv(
            "MODEL_PATH",
            os.path.join(os.path.dirname(__file__), "../models/bilstm_dkt_model.pth"),
        )
        path = os.path.abspath(path)

        if not os.path.exists(path):
            logger.warning(f"Model file not found at {path}. Using heuristic fallback.")
            cls._loaded = True
            return

        try:
            model = BiLSTM_DKT()
            state = torch.load(path, map_location=torch.device("cpu"))
            # Handle both raw state_dict and wrapped checkpoint formats
            if isinstance(state, dict) and "model_state_dict" in state:
                state = state["model_state_dict"]
            model.load_state_dict(state)
            model.eval()
            cls._model = model
            logger.info(f"BiLSTM DKT model loaded from {path}")
        except Exception as exc:
            logger.error(f"Failed to load DKT model: {exc}. Using heuristic fallback.")

        cls._loaded = True

    @classmethod
    def predict_mastery(cls, interaction_history: List[dict]) -> float:
        """
        Given a list of recent interactions:
          [{"material_id": int, "score": int, "duration": int, "mastery": float}, ...]
        Returns a predicted mastery probability (0.0 – 1.0).
        """
        if not cls._loaded:
            cls.load()

        if cls._model is None or not TORCH_AVAILABLE or not interaction_history:
            # Heuristic fallback: weighted average of recent quiz scores
            if not interaction_history:
                return 0.3
            scores = [i.get("score", 0) / 100.0 for i in interaction_history[-15:]]
            weights = list(range(1, len(scores) + 1))
            return round(sum(s * w for s, w in zip(scores, weights)) / sum(weights), 4)

        # Build input tensor: sequence of (material_id_norm, score_norm, duration_norm, mastery)
        seq = interaction_history[-15:]  # model was trained on max 15 steps
        features = []
        for item in seq:
            features.append([
                (item.get("material_id", 0) % 100) / 100.0,  # normalised material id
                item.get("score", 0) / 100.0,
                min(item.get("duration", 0) / 3600.0, 1.0),  # normalise to hours
                item.get("mastery", 0.3),
            ])

        # Pad to 15 steps if shorter
        while len(features) < 15:
            features.insert(0, [0.0, 0.0, 0.0, 0.0])

        with torch.no_grad():
            x = torch.tensor([features], dtype=torch.float32)  # (1, 15, 4)
            pred = cls._model(x)
            return round(float(pred.squeeze()), 4)
