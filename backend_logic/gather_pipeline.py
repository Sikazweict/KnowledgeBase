import spacy
from spacy.matcher import Matcher
from typing import List, Dict

# Load spaCy NLP model (Technical/Institutional focus)
# Target F1-score: >= 90%
try:
    nlp = spacy.load("en_core_web_trf")  # Transform-based model for higher precision
except:
    nlp = spacy.load("en_core_web_md")

def preprocess_text(text: str) -> str:
    """
    Text Preprocessing: Tokenization, stop-word removal, and lemmatization.
    """
    doc = nlp(text)
    tokens = [token.lemma_.lower() for token in doc if not token.is_stop and not token.is_punct]
    return " ".join(tokens)

def extract_entities(text: str) -> List[Dict]:
    """
    Entity Extraction: Named Entity Recognition (NER) to classify key entities.
    Classification: Researcher, Project, Department, Keyword, Methodology.
    """
    doc = nlp(text)
    entities = []
    
    # Custom rule-based extraction for 'Methodology' or 'Project' if not in default NER
    # In a production system, these labels would be trained into a custom spaCy NER head
    for ent in doc.ents:
        entities.append({
            "text": ent.text,
            "label": ent.label_,
            "start": ent.start_char,
            "end": ent.end_char
        })
    return entities

def extract_relationships(doc_text: str) -> List[Dict]:
    """
    Relationship Extraction: Establish relationships between entities.
    Example: Author-AuthoredPaper, Project-Uses-Methodology.
    """
    doc = nlp(doc_text)
    relationships = []
    
    # Dependency parsing to find Subject-Verb-Object structures
    for token in doc:
        if token.dep_ in ("nsubj", "nsubjpass"):
            subject = token.text
            verb = token.head.text
            object_ = [child.text for child in token.head.children if child.dep_ in ("dobj", "pobj")]
            
            if object_:
                relationships.append({
                    "subject": subject,
                    "predicate": verb,
                    "object": object_[0]
                })
                
    return relationships

if __name__ == "__main__":
    raw_text = "Prof. Sarah Miller at the Department of Quantum Physics is leading Project Genesis utilizing Neural Network methodologies."
    print("Preprocessed:", preprocess_text(raw_text))
    print("Entities:", extract_entities(raw_text))
    print("Relationships:", extract_relationships(raw_text))
