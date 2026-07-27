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

        public static Sprite GlowSprite(int size = 64)
        {
            var key = $"procedural:glow:{size}";
            if (Cache.TryGetValue(key, out var cached)) return cached;
            var texture = new Texture2D(size, size, TextureFormat.RGBA32, false)
            {
                name = key,
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Clamp
            };
            var pixels = new Color[size * size];
            var center = (size - 1) * 0.5f;
            for (var y = 0; y < size; y++)
            for (var x = 0; x < size; x++)
            {
                var distance = Vector2.Distance(new Vector2(x, y), new Vector2(center, center)) / center;
                var alpha = Mathf.Pow(Mathf.Clamp01(1f - distance), 2.2f);
                pixels[y * size + x] = new Color(1f, 1f, 1f, alpha);
            }
            texture.SetPixels(pixels);
            texture.Apply();
            var sprite = Sprite.Create(texture, new Rect(0f, 0f, size, size), Vector2.one * 0.5f, size);
            sprite.name = key;
            Cache[key] = sprite;
            return sprite;
        }

        public static Sprite RingSprite(int size = 96)
        {
            var key = $"procedural:ring:{size}";
            if (Cache.TryGetValue(key, out var cached)) return cached;
            var texture = new Texture2D(size, size, TextureFormat.RGBA32, false)
            {
                name = key,
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Clamp
            };
            var pixels = new Color[size * size];
            var center = (size - 1) * 0.5f;
            for (var y = 0; y < size; y++)
            for (var x = 0; x < size; x++)
            {
                var distance = Vector2.Distance(new Vector2(x, y), new Vector2(center, center)) / center;
                var ring = 1f - Mathf.Clamp01(Mathf.Abs(distance - 0.73f) / 0.09f);
                var glow = Mathf.Clamp01(1f - Mathf.Abs(distance - 0.73f) / 0.24f) * 0.32f;
                pixels[y * size + x] = new Color(1f, 1f, 1f, Mathf.Clamp01(ring + glow));
            }
            texture.SetPixels(pixels);
            texture.Apply();
            var sprite = Sprite.Create(texture, new Rect(0f, 0f, size, size), Vector2.one * 0.5f, size);
            sprite.name = key;
            Cache[key] = sprite;
            return sprite;
        }

        public static Sprite ArcSprite(float arcRadians, int size = 128)
        {
            var roundedArc = Mathf.Round(Mathf.Clamp(arcRadians, 0.35f, Mathf.PI * 1.8f) * 100f) / 100f;
            var key = $"procedural:arc:{roundedArc}:{size}";
            if (Cache.TryGetValue(key, out var cached)) return cached;
            var texture = new Texture2D(size, size, TextureFormat.RGBA32, false)
            {
                name = key,
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Clamp
            };
            var pixels = new Color[size * size];
            var center = (size - 1) * 0.5f;
            for (var y = 0; y < size; y++)
            for (var x = 0; x < size; x++)
            {
                var delta = new Vector2(x - center, y - center);
                var distance = delta.magnitude / center;
                var angle = Mathf.Abs(Mathf.Atan2(delta.y, delta.x));
                var insideAngle = 1f - Mathf.Clamp01((angle - roundedArc * 0.5f + 0.055f) / 0.055f);
                var blade = 1f - Mathf.Clamp01(Mathf.Abs(distance - 0.7f) / 0.075f);
                var glow = Mathf.Clamp01(1f - Mathf.Abs(distance - 0.7f) / 0.2f) * 0.28f;
                var alpha = insideAngle * Mathf.Clamp01(blade + glow);
                pixels[y * size + x] = new Color(1f, 1f, 1f, alpha);
            }
            texture.SetPixels(pixels);
            texture.Apply();
            var sprite = Sprite.Create(texture, new Rect(0f, 0f, size, size), Vector2.one * 0.5f, size);
            sprite.name = key;
            Cache[key] = sprite;
            return sprite;
        }

        public static Sprite BoltSprite(int width = 96, int height = 32)
        {
            var key = $"procedural:bolt:{width}:{height}";
            if (Cache.TryGetValue(key, out var cached)) return cached;
            var texture = new Texture2D(width, height, TextureFormat.RGBA32, false)
            {
                name = key,
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Clamp
            };
            var pixels = new Color[width * height];
            var centerY = (height - 1) * 0.5f;
            for (var y = 0; y < height; y++)
            for (var x = 0; x < width; x++)
            {
                var vertical = Mathf.Abs(y - centerY) / centerY;
                var tip = Mathf.Clamp01((width - x) / (width * 0.2f));
                var tail = Mathf.Clamp01(x / (width * 0.35f));
                var core = Mathf.Pow(Mathf.Clamp01(1f - vertical), 2.8f);
                var alpha = core * Mathf.Min(tip, Mathf.Lerp(0.25f, 1f, tail));
                pixels[y * width + x] = new Color(1f, 1f, 1f, alpha);
            }
            texture.SetPixels(pixels);
            texture.Apply();
            var sprite = Sprite.Create(texture, new Rect(0f, 0f, width, height), new Vector2(0.5f, 0.5f), height);
            sprite.name = key;
            Cache[key] = sprite;
            return sprite;
        }

        public static Sprite DiamondSprite(int size = 48)
        {
            var key = $"procedural:diamond:{size}";
            if (Cache.TryGetValue(key, out var cached)) return cached;
            var texture = new Texture2D(size, size, TextureFormat.RGBA32, false)
            {
                name = key,
                filterMode = FilterMode.Bilinear,
                wrapMode = TextureWrapMode.Clamp
            };
            var pixels = new Color[size * size];
            var center = (size - 1) * 0.5f;
            for (var y = 0; y < size; y++)
            for (var x = 0; x < size; x++)
            {
                var distance = (Mathf.Abs(x - center) + Mathf.Abs(y - center)) / center;
                var alpha = Mathf.Clamp01((1f - distance) * 8f);
                var glow = Mathf.Clamp01(1.25f - distance) * 0.25f;
                pixels[y * size + x] = new Color(1f, 1f, 1f, Mathf.Max(alpha, glow));
            }
            texture.SetPixels(pixels);
            texture.Apply();
            var sprite = Sprite.Create(texture, new Rect(0f, 0f, size, size), Vector2.one * 0.5f, size);
            sprite.name = key;
            Cache[key] = sprite;
            return sprite;
        }
    }
}
