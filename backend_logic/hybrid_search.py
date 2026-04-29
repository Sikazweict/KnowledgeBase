from sentence_transformers import SentenceTransformer
import numpy as np
from typing import List, Dict

# Mock vector DB integration (ChromaDB style)
class VectorSearch:
    def __init__(self, model_name='all-MiniLM-L6-v2'):
        self.model = SentenceTransformer(model_name)
        self.collection = [] # Placeholder for actual ChromaDB/LanceDB collection

    def index_documents(self, documents: List[str]):
        # Convert documents to embeddings
        embeddings = self.model.encode(documents)
        # In actual ChromaDB: self.collection.add(documents=documents, embeddings=embeddings)
        return embeddings

def bm25_search(query: str, corpus: List[str]) -> List[float]:
    """
    Traditional keyword-based search heuristic (Placeholder).
    Combines with semantic search to create the Hybrid System.
    """
    # Simple keyword match frequency for prototype logic
    query_terms = query.lower().split()
    scores = []
    for doc in corpus:
        score = sum(1 for term in query_terms if term in doc.lower())
        scores.append(float(score))
    return scores

def hybrid_search(query: str, corpus: List[str], alpha: float = 0.5):
    """
    Logic that combines BM25 and Vector Search.
    alpha: weighting factor between keyword and semantic importance.
    Target: 25% improvement in Mean Reciprocal Rank (MRR).
    """
    # 1. Semantic Search (Dense)
    model = SentenceTransformer('all-MiniLM-L6-v2')
    query_vec = model.encode([query])
    corpus_vecs = model.encode(corpus)
    
    # Cosine Similarity
    semantic_scores = np.dot(corpus_vecs, query_vec.T).flatten()
    
    # 2. Keyword Search (Sparse)
    keyword_scores = np.array(bm25_search(query, corpus))
    
    # Normalize scores
    semantic_scores = (semantic_scores - np.min(semantic_scores)) / (np.max(semantic_scores) - np.min(semantic_scores) + 1e-6)
    keyword_scores = (keyword_scores - np.min(keyword_scores)) / (np.max(keyword_scores) - np.min(keyword_scores) + 1e-6)
    
    # 3. Reranking (Reciprocal Rank Fusion or Linear Weighted Combination)
    hybrid_scores = (alpha * semantic_scores) + ((1 - alpha) * keyword_scores)
    
    results = sorted(zip(range(len(corpus)), hybrid_scores), key=lambda x: x[1], reverse=True)
    return results

if __name__ == "__main__":
    corpus = [
        "Research paper on quantum computing and neural networks",
        "Administrative policy update for the university lab",
        "Lecture notes on ancient history and archeology",
        "Drafting a 새로운 project leveraging AI and deep learning"
    ]
    query = "AI based neural network research projects"
    results = hybrid_search(query, corpus)
    print("Top Result:", corpus[results[0][0]], "| Score:", results[0][1])
