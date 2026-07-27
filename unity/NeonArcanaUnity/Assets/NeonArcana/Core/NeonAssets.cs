using System.Collections.Generic;
using UnityEngine;

namespace NeonArcana
{
    public static class NeonAssets
    {
        private static readonly Dictionary<string, Sprite> Cache = new();

        public static Sprite SpriteFrame(string resourcePath, int column, int row, int columns = 2, int rows = 2, float pixelsPerUnit = 300f)
        {
            var key = $"{resourcePath}:{column}:{row}:{columns}:{rows}:{pixelsPerUnit}";
            if (Cache.TryGetValue(key, out var cached)) return cached;

            var texture = Resources.Load<Texture2D>(resourcePath);
            if (texture == null) return null;
            texture.filterMode = FilterMode.Bilinear;
            var width = texture.width / columns;
            var height = texture.height / rows;
            var rect = new Rect(column * width, (rows - row - 1) * height, width, height);
            var sprite = Sprite.Create(texture, rect, new Vector2(0.5f, 0.42f), pixelsPerUnit, 0, SpriteMeshType.FullRect);
            sprite.name = key;
            Cache[key] = sprite;
            return sprite;
        }

        public static Sprite FullSprite(string resourcePath, float pixelsPerUnit = 100f)
        {
            var key = $"{resourcePath}:full:{pixelsPerUnit}";
            if (Cache.TryGetValue(key, out var cached)) return cached;
            var texture = Resources.Load<Texture2D>(resourcePath);
            if (texture == null) return null;
            var sprite = Sprite.Create(texture, new Rect(0, 0, texture.width, texture.height), new Vector2(0.5f, 0.5f), pixelsPerUnit);
            sprite.name = key;
            Cache[key] = sprite;
            return sprite;
        }

        public static Sprite SolidSprite(Color color)
        {
            var key = $"solid:{ColorUtility.ToHtmlStringRGBA(color)}";
            if (Cache.TryGetValue(key, out var cached)) return cached;
            var texture = new Texture2D(2, 2, TextureFormat.RGBA32, false);
            texture.SetPixels(new[] { color, color, color, color });
            texture.Apply();
            var sprite = Sprite.Create(texture, new Rect(0, 0, 2, 2), new Vector2(0.5f, 0.5f), 2f);
            Cache[key] = sprite;
            return sprite;
        }
    }
}
