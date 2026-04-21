import numpy as np
from sklearn.cluster import KMeans

def ejecutar_clustering_logistico(pedidos: list, n_clusters: int = 3):
    X = np.array(pedidos)
    model = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    model.fit(X)
    return model.cluster_centers_.tolist(), X.tolist()

def ejecutar_clustering_terreno(datos: list, n_clusters: int = 3):
    X = np.array(datos)
    model = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    model.fit(X)
    return model.cluster_centers_.tolist()