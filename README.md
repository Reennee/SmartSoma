# SmartSoma: AI-Powered Personalized Learning for Rwanda 🇷🇼

**An Offline-First Edge Computing Framework for Personalized Learning**

![ML Track](https://img.shields.io/badge/Track-ML-blue)
![Python](https://img.shields.io/badge/Python-3.9+-green)
![FastAPI](https://img.shields.io/badge/FastAPI-0.103-teal)
![PyTorch](https://img.shields.io/badge/PyTorch-2.1-red)
![React](https://img.shields.io/badge/React-18-61DAFB)

## 🎓 Project Overview

SmartSoma is an AI-driven educational recommender system that delivers personalized, curriculum-aligned study materials to secondary students in Rwanda. The system uses **Deep Knowledge Tracing (DKT)** with BiLSTM neural networks to predict student mastery levels and recommend optimal learning resources, even in offline environments.

### Problem Statement

Rwandan secondary students face:
- **High Student-Teacher Ratios**: 36:1, making personalized attention impossible
- **Repetition Crisis**: 21.4% repetition rate in lower secondary
- **Digital Divide**: 38-43% of schools lack internet connectivity
- **Information Overload**: REB e-portal has thousands of unranked materials

### Solution

SmartSoma provides a **24/7 AI tutor** that:
- ✅ Runs locally on school servers (Edge Computing)
- ✅ Works 100% offline after initial setup
- ✅ Predicts student performance using BiLSTM models
- ✅ Recommends CBC-aligned materials based on individual gaps
- ✅ Provides real-time teacher dashboards for data-driven intervention

---

## 📂 Project Structure

```
SmartSoma/
├── notebooks/
│   └── model_development.ipynb    # ⭐ Core ML notebook (BiLSTM + metrics)
├── backend/
│   └── main.py                    # FastAPI server with ML inference
├── data/
│   ├── students.csv               # 50 synthetic students
│   ├── materials.csv              # 100 CBC-aligned materials
│   └── interactions.csv           # 1,200+ student interactions
├── scripts/
│   └── synthetic_data_generator.py # Data generation script
├── models/
│   ├── bilstm_dkt_model.pth      # Trained BiLSTM weights
│   ├── performance_summary.txt    # Model metrics
│   └── viz_*.png                  # Performance visualizations
├── frontend/                      # React PWA (student/teacher dashboards)
├── requirements.txt               # Python dependencies
└── README.md                      # This file
```

---

## 🔬 ML Model Architecture

### BiLSTM Deep Knowledge Tracing

The core AI engine uses a **Bidirectional LSTM** to model student learning as a sequence:

```
Input: [material_id, score, duration, mastery]  (sequence of 15 interactions)
    ↓
Embedding Layer
    ↓
BiLSTM (128 hidden units, 2 layers, dropout=0.3)
    ↓
Fully Connected (64 neurons)
    ↓
Sigmoid Output → Predicted Mastery Level (0-1)
```

**Training Details:**
- **Dataset**: 1,200 interactions, 50 students, 100 materials
- **Train/Test Split**: 80/20
- **Optimizer**: Adam (lr=0.001)
- **Loss Function**: MSE
- **Epochs**: 30

---

## 📊 Performance Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| **RMSE** | 0.18 |  < 0.25 | ✅ **Excellent** |
| **MAE** | 0.14 | < 0.20 | ✅ **Excellent** |
| **R² Score** | 0.82 | > 0.70 | ✅ **Strong** |
| **Accuracy** | 87.3% | > 80% | ✅ **High** |
| **AUC-ROC** | 0.91 | > 0.75 | ✅ **Excellent** |
| **Precision@5** | 0.78 | > 0.70 | ✅ **Good** |

### Visualizations

All performance visualizations are saved in `models/`:
- `viz_mastery_distribution.png` - Student mastery distribution
- `viz_competency_mastery.png` - Performance by CBC competency
- `viz_training_history.png` - Loss curves
- `viz_predictions.png` - Actual vs predicted scatter plot
- `viz_confusion_matrix.png` - Binary classification matrix
- `viz_roc_curve.png` - ROC curve with AUC
- `viz_precision_at_k.png` - Recommendation quality

---

## 🛠️ Setup Instructions

### Prerequisites

- Python 3.9+
- Node.js 16+ (for frontend)
- 2GB RAM minimum
- macOS/Linux/Windows

### 1. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/SmartSoma.git
cd SmartSoma
```

### 2. Backend Setup

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate

# Install dependencies
pip install -r requirements.txt

# Generate synthetic data (if not already present)
python scripts/synthetic_data_generator.py

# Start FastAPI server
uvicorn backend.main:app --reload

# Server will be available at: http://localhost:8000
# Swagger UI docs: http://localhost:8000/docs
```

### 3. Run Jupyter Notebook

```bash
# Activate environment
source venv/bin/activate

# Launch Jupyter
jupyter notebook notebooks/model_development.ipynb

# Run all cells to:
# - Visualize data
# - Train BiLSTM model
# - Generate performance metrics
# - Export trained model
```

## 🚀 API Documentation

### Base URL
```
http://localhost:8000
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check |
| `GET` | `/api/stats` | System statistics |
| `POST` | `/api/recommend` | Get personalized recommendations |
| `POST` | `/api/track-interaction` | Log student interaction |
| `GET` | `/api/student/{id}/progress` | Student progress dashboard |
| `GET` | `/api/materials` | List all materials |

### Example: Get Recommendations

**Request:**
```bash
curl -X POST http://localhost:8000/api/recommend \\
  -H "Content-Type: application/json" \\
  -d '{
    "student_id": 1,
    "limit": 5,
    "subject": "Mathematics"
  }'
```

**Response:**
```json
[
  {
    "material_id": 42,
    "title": "Mathematics - Algebra and Equations - Lesson 5",
    "subject": "Mathematics",
    "competency": "Algebra and Equations",
    "grade_level": "S2",
    "difficulty": "Intermediate",
    "predicted_mastery": 0.653,
    "relevance_score": 0.872
  }
]
```

### Key Components

1. **Frontend (React PWA)**:  
   - Student dashboard with personalized recommendations
   - Teacher analytics with class-wide insights
   - Offline-first with Service Workers

2. **Backend (FastAPI)**:  
   - RESTful API for all operations
   - Runs on local school server (Raspberry Pi)
   - Auto-generated Swagger documentation

3. **ML Engine (BiLSTM)**:  
   - Deep Knowledge Tracing for mastery prediction
   - Hybrid recommendation (content-based + collaborative)
   - Optimized for low-resource devices

4. **Data Layer**:  
   - SQLite for local storage
   - Optional PostgreSQL for cloud sync
   - CSV exports for portability

---

## 📐 Database Schema (ERD)

```
┌─────────────┐         ┌──────────────┐         ┌────────────────┐
│  students   │         │ interactions │         │   materials    │
├─────────────┤         ├──────────────┤         ├────────────────┤
│ student_id  │◄───────┤ student_id   │         │ material_id    │
│ name        │         │ material_id  ├────────►│ title          │
│ grade_level │         │ timestamp    │         │ subject        │
│ baseline... │         │ score        │         │ competency     │
└─────────────┘         │ mastery_level│         │ difficulty     │
                        │ duration...  │         │ grade_level    │
                        └──────────────┘         └────────────────┘
```

---

## 👨‍💻 Author

**René Ntabana**  
BSc. Software Engineering  
African Leadership University

**Supervisor**: Simeon Nsabiyumva  
**Date**: February 2026

---

## 📚 References

1. Nsabimana et al. (2024). *Smart classrooms and education outcomes in Rwanda*. UNU-WIDER.
2. Airlangga, G. (2024). *Predicting Student Performance Using BiLSTM*. MALCOM Journal.
3. Minecofin (2020). *Rwanda Vision 2050*. Government of Rwanda.
4. REB (2025). *Competence-Based Curriculum Resources*. Rwanda Education Board.

---

## 🙏 Acknowledgments

- Rwanda Education Board (REB) for curriculum resources
- UNU-WIDER for research insights on smart classrooms in Rwanda
- The open-source ML community (PyTorch, FastAPI, scikit-learn)

---

**SmartSoma** - *Democratizing personalized education for Rwanda's last-mile learners* 🚀