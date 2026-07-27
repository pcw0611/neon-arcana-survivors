using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace NeonArcana
{
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class MiniMapGraphic : MaskableGraphic
    {
        [SerializeField] private Color ringColor = new(0.2f, 0.9f, 1f, 0.75f);
        [SerializeField] private Color hostileColor = new(1f, 0.2f, 0.65f, 0.95f);
        [SerializeField] private Color playerColor = new(0.55f, 1f, 1f, 1f);
        [SerializeField] private float worldRange = 10f;
        private readonly List<Vector2> hostiles = new(96);
        private float refreshClock;

        protected override void Awake()
        {
            base.Awake();
            raycastTarget = false;
            color = Color.white;
        }

        private void Update()
        {
            refreshClock -= Time.unscaledDeltaTime;
            if (refreshClock > 0f) return;
            refreshClock = 0.08f;
            var player = GameManager.Instance?.Player;
            if (player == null) hostiles.Clear();
            else EnemyController.FillMinimap(player.transform.position, worldRange, hostiles);
            SetVerticesDirty();
        }

        protected override void OnPopulateMesh(VertexHelper vertexHelper)
        {
            vertexHelper.Clear();
            var rect = GetPixelAdjustedRect();
            var center = rect.center;
            var radius = Mathf.Min(rect.width, rect.height) * 0.47f;
            const int segments = 48;
            const float thickness = 2.2f;

            for (var i = 0; i < segments; i++)
            {
                var angleA = i * Mathf.PI * 2f / segments;
                var angleB = (i + 1) * Mathf.PI * 2f / segments;
                var directionA = new Vector2(Mathf.Cos(angleA), Mathf.Sin(angleA));
                var directionB = new Vector2(Mathf.Cos(angleB), Mathf.Sin(angleB));
                AddQuad(
                    vertexHelper,
                    center + directionA * (radius - thickness),
                    center + directionA * radius,
                    center + directionB * radius,
                    center + directionB * (radius - thickness),
                    ringColor);
            }

            AddTriangle(
                vertexHelper,
                center + new Vector2(0f, 7f),
                center + new Vector2(-5.5f, -5f),
                center + new Vector2(5.5f, -5f),
                playerColor);

            foreach (var hostile in hostiles)
            {
                var position = center + new Vector2(hostile.x, hostile.y) * radius;
                var size = hostile.sqrMagnitude > 0.72f ? 2.2f : 2.8f;
                AddQuad(
                    vertexHelper,
                    position + new Vector2(-size, -size),
                    position + new Vector2(-size, size),
                    position + new Vector2(size, size),
                    position + new Vector2(size, -size),
                    hostileColor);
            }
        }

        private static void AddQuad(VertexHelper helper, Vector2 a, Vector2 b, Vector2 c, Vector2 d, Color color)
        {
            var start = helper.currentVertCount;
            helper.AddVert(a, color, Vector2.zero);
            helper.AddVert(b, color, Vector2.zero);
            helper.AddVert(c, color, Vector2.zero);
            helper.AddVert(d, color, Vector2.zero);
            helper.AddTriangle(start, start + 1, start + 2);
            helper.AddTriangle(start, start + 2, start + 3);
        }

        private static void AddTriangle(VertexHelper helper, Vector2 a, Vector2 b, Vector2 c, Color color)
        {
            var start = helper.currentVertCount;
            helper.AddVert(a, color, Vector2.zero);
            helper.AddVert(b, color, Vector2.zero);
            helper.AddVert(c, color, Vector2.zero);
            helper.AddTriangle(start, start + 1, start + 2);
        }
    }
}
