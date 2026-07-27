using System.Collections.Generic;
using UnityEngine;

namespace NeonArcana
{
    public sealed class CombatPulse : MonoBehaviour
    {
        private static readonly Queue<CombatPulse> Pool = new();
        private float life;
        private float maximumLife;
        private float radius;
        [SerializeField] private SpriteRenderer renderer;

        public static void Spawn(Vector3 position, float radius, Color color)
        {
            var pulse = Pool.Count > 0 ? Pool.Dequeue() : Create();
            pulse.transform.position = position;
            pulse.transform.rotation = Quaternion.identity;
            pulse.radius = Mathf.Max(0.15f, radius);
            pulse.life = pulse.maximumLife = 0.24f;
            pulse.renderer.sprite = NeonAssets.RingSprite();
            pulse.renderer.color = color;
            pulse.gameObject.SetActive(true);
        }

        public static void SpawnArc(Vector3 position, float radius, Vector2 direction, float arcRadians, Color color)
        {
            var pulse = Pool.Count > 0 ? Pool.Dequeue() : Create();
            pulse.transform.position = position;
            pulse.transform.rotation = Quaternion.Euler(0f, 0f, Mathf.Atan2(direction.y, direction.x) * Mathf.Rad2Deg);
            pulse.radius = Mathf.Max(0.15f, radius);
            pulse.life = pulse.maximumLife = 0.24f;
            pulse.renderer.sprite = NeonAssets.ArcSprite(arcRadians);
            pulse.renderer.color = color;
            pulse.gameObject.SetActive(true);
        }

        private static CombatPulse Create()
        {
            var prefab = Resources.Load<GameObject>("Prefabs/CombatPulse");
            var gameObject = prefab != null ? Instantiate(prefab) : CreateTemplate();
            gameObject.name = "Combat Pulse";
            var pulse = gameObject.GetComponent<CombatPulse>();
            pulse.ResolveVisuals();
            gameObject.SetActive(false);
            return pulse;
        }

        public static GameObject CreateTemplate()
        {
            var gameObject = new GameObject("CombatPulse", typeof(SpriteRenderer), typeof(CombatPulse));
            var pulse = gameObject.GetComponent<CombatPulse>();
            pulse.renderer = gameObject.GetComponent<SpriteRenderer>();
            pulse.renderer.sprite = NeonAssets.RingSprite();
            pulse.renderer.sortingOrder = 14;
            return gameObject;
        }

        private void Awake()
        {
            ResolveVisuals();
        }

        private void ResolveVisuals()
        {
            if (renderer == null) renderer = GetComponent<SpriteRenderer>();
            if (renderer != null)
            {
                if (renderer.sprite == null) renderer.sprite = NeonAssets.RingSprite();
                renderer.sortingOrder = 14;
            }
        }

        private void Update()
        {
            life -= Time.deltaTime;
            var progress = 1f - life / maximumLife;
            transform.localScale = Vector3.one * Mathf.Lerp(0.15f, radius * 2f, progress);
            var color = renderer.color;
            color.a = Mathf.Lerp(0.45f, 0f, progress);
            renderer.color = color;
            if (life <= 0f)
            {
                gameObject.SetActive(false);
                Pool.Enqueue(this);
            }
        }
    }
}
