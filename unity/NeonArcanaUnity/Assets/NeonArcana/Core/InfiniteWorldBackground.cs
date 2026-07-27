using System.Collections.Generic;
using UnityEngine;

namespace NeonArcana
{
    [DisallowMultipleComponent]
    public sealed class InfiniteWorldBackground : MonoBehaviour
    {
        public const int TileColumns = 5;
        public const int TileRows = 5;

        [Header("City tiles")]
        [SerializeField] private string cityResourcePath = "Art/cyber-city";
        [SerializeField] private float pixelsPerUnit = 100f;
        [SerializeField] private Color cityTint = new(0.58f, 0.68f, 0.9f, 0.62f);
        [SerializeField] private int citySortingOrder = -100;

        [Header("World grid")]
        [SerializeField] private float gridSpacing = 0.72f;
        [SerializeField] private Color gridColor = new(0.3f, 0.81f, 1f, 0.08f);
        [SerializeField] private float gridHalfWidth = 24f;
        [SerializeField] private float gridHalfHeight = 14f;
        [SerializeField] private int gridSortingOrder = -98;

        [Header("Atmosphere")]
        [SerializeField] private Color hazeColor = new(0.18f, 0.04f, 0.48f, 0.16f);
        [SerializeField] private Vector2 hazeSize = new(15f, 9f);

        private readonly List<SpriteRenderer> tileRenderers = new(TileColumns * TileRows);
        private Camera targetCamera;
        private Transform tileLayer;
        private Transform haze;
        private MeshFilter gridFilter;
        private MeshRenderer gridRenderer;
        private Vector2Int currentTileCell = new(int.MinValue, int.MinValue);
        private Vector2Int currentGridCell = new(int.MinValue, int.MinValue);
        private float tileWidth;
        private float tileHeight;

        public int ActiveTileCount => tileRenderers.Count;
        public float TileWidth => tileWidth;
        public Vector2 TileAnchor => tileLayer != null ? tileLayer.position : Vector2.zero;
        public Vector2 GridAnchor => gridFilter != null ? gridFilter.transform.position : Vector2.zero;
        public bool IsReady => tileRenderers.Count == TileColumns * TileRows
                               && gridFilter != null
                               && gridFilter.sharedMesh != null
                               && gridFilter.sharedMesh.vertexCount > 0;

        public void Initialize(Camera camera)
        {
            targetCamera = camera;
            BuildIfNeeded();
            ForceRefresh();
        }

        private void Awake()
        {
            BuildIfNeeded();
        }

        private void LateUpdate()
        {
            if (targetCamera == null) targetCamera = Camera.main;
            if (targetCamera == null) return;
            RefreshAround(targetCamera.transform.position);
        }

        private void OnDestroy()
        {
            if (gridFilter != null && gridFilter.sharedMesh != null) Destroy(gridFilter.sharedMesh);
            if (gridRenderer != null && gridRenderer.sharedMaterial != null) Destroy(gridRenderer.sharedMaterial);
        }

        private void BuildIfNeeded()
        {
            var legacyRenderer = GetComponent<SpriteRenderer>();
            if (legacyRenderer != null) legacyRenderer.enabled = false;

            var citySprite = NeonAssets.FullSprite(cityResourcePath, pixelsPerUnit);
            if (citySprite == null) return;
            tileWidth = citySprite.bounds.size.x;
            tileHeight = citySprite.bounds.size.y;

            tileLayer = transform.Find("Infinite City Tiles");
            if (tileLayer == null)
            {
                var layerObject = new GameObject("Infinite City Tiles");
                tileLayer = layerObject.transform;
                tileLayer.SetParent(transform, false);
            }

            tileRenderers.Clear();
            foreach (Transform child in tileLayer)
            {
                var renderer = child.GetComponent<SpriteRenderer>();
                if (renderer != null) tileRenderers.Add(renderer);
            }

            while (tileRenderers.Count < TileColumns * TileRows)
            {
                var index = tileRenderers.Count;
                var tile = new GameObject($"City Tile {index + 1:00}", typeof(SpriteRenderer));
                tile.transform.SetParent(tileLayer, false);
                tileRenderers.Add(tile.GetComponent<SpriteRenderer>());
            }

            for (var i = 0; i < tileRenderers.Count; i++)
            {
                var renderer = tileRenderers[i];
                renderer.sprite = citySprite;
                renderer.color = cityTint;
                renderer.sortingOrder = citySortingOrder;
                renderer.transform.localScale = new Vector3(1.002f, 1.002f, 1f);
            }

            BuildGrid();
            BuildHaze();
        }

        private void BuildGrid()
        {
            var gridTransform = transform.Find("World Grid");
            if (gridTransform == null)
            {
                var gridObject = new GameObject("World Grid", typeof(MeshFilter), typeof(MeshRenderer));
                gridTransform = gridObject.transform;
                gridTransform.SetParent(transform, false);
            }

            gridFilter = gridTransform.GetComponent<MeshFilter>();
            gridRenderer = gridTransform.GetComponent<MeshRenderer>();
            if (gridFilter.sharedMesh == null)
            {
                gridFilter.sharedMesh = CreateGridMesh();
                gridFilter.sharedMesh.name = "Neon Arcana Infinite Grid";
            }

            if (gridRenderer.sharedMaterial == null)
            {
                var shader = Shader.Find("Sprites/Default");
                gridRenderer.sharedMaterial = new Material(shader)
                {
                    name = "Neon Arcana Grid Material",
                    color = gridColor,
                    hideFlags = HideFlags.DontSave
                };
            }
            gridRenderer.sortingOrder = gridSortingOrder;
        }

        private Mesh CreateGridMesh()
        {
            var vertices = new List<Vector3>(256);
            for (var x = -gridHalfWidth; x <= gridHalfWidth + 0.001f; x += gridSpacing)
            {
                vertices.Add(new Vector3(x, -gridHalfHeight, 0f));
                vertices.Add(new Vector3(x, gridHalfHeight, 0f));
            }
            for (var y = -gridHalfHeight; y <= gridHalfHeight + 0.001f; y += gridSpacing)
            {
                vertices.Add(new Vector3(-gridHalfWidth, y, 0f));
                vertices.Add(new Vector3(gridHalfWidth, y, 0f));
            }

            var indices = new int[vertices.Count];
            for (var i = 0; i < indices.Length; i++) indices[i] = i;
            var mesh = new Mesh { hideFlags = HideFlags.DontSave };
            mesh.SetVertices(vertices);
            mesh.SetIndices(indices, MeshTopology.Lines, 0);
            mesh.RecalculateBounds();
            return mesh;
        }

        private void BuildHaze()
        {
            haze = transform.Find("Rift Haze");
            if (haze == null)
            {
                var hazeObject = new GameObject("Rift Haze", typeof(SpriteRenderer));
                haze = hazeObject.transform;
                haze.SetParent(transform, false);
            }

            var renderer = haze.GetComponent<SpriteRenderer>();
            if (renderer == null) renderer = haze.gameObject.AddComponent<SpriteRenderer>();
            renderer.sprite = NeonAssets.GlowSprite();
            renderer.color = hazeColor;
            renderer.sortingOrder = citySortingOrder + 1;
            haze.localScale = new Vector3(hazeSize.x, hazeSize.y, 1f);
        }

        private void ForceRefresh()
        {
            currentTileCell = new Vector2Int(int.MinValue, int.MinValue);
            currentGridCell = new Vector2Int(int.MinValue, int.MinValue);
            if (targetCamera != null) RefreshAround(targetCamera.transform.position);
        }

        private void RefreshAround(Vector3 cameraPosition)
        {
            if (tileWidth <= 0f || tileHeight <= 0f || tileRenderers.Count == 0) BuildIfNeeded();
            if (tileWidth <= 0f || tileHeight <= 0f) return;

            var tileCell = new Vector2Int(
                Mathf.RoundToInt(cameraPosition.x / tileWidth),
                Mathf.RoundToInt(cameraPosition.y / tileHeight));
            if (tileCell != currentTileCell)
            {
                currentTileCell = tileCell;
                tileLayer.position = new Vector3(tileCell.x * tileWidth, tileCell.y * tileHeight, 2f);
                var index = 0;
                for (var y = -(TileRows / 2); y <= TileRows / 2; y++)
                for (var x = -(TileColumns / 2); x <= TileColumns / 2; x++)
                {
                    tileRenderers[index].transform.localPosition = new Vector3(x * tileWidth, y * tileHeight, 0f);
                    index++;
                }
            }

            var gridCell = new Vector2Int(
                Mathf.FloorToInt(cameraPosition.x / gridSpacing),
                Mathf.FloorToInt(cameraPosition.y / gridSpacing));
            if (gridCell != currentGridCell)
            {
                currentGridCell = gridCell;
                gridFilter.transform.position = new Vector3(gridCell.x * gridSpacing, gridCell.y * gridSpacing, 1.8f);
            }

            if (haze != null) haze.position = new Vector3(cameraPosition.x, cameraPosition.y, 1.9f);
        }
    }
}
