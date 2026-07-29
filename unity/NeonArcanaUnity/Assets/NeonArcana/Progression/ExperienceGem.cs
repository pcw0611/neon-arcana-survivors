using System.Collections.Generic;
using UnityEngine;

namespace NeonArcana
{
    public sealed class ExperienceGem : MonoBehaviour
    {
        private static readonly List<ExperienceGem> Active = new();
        private static readonly Queue<ExperienceGem> Pool = new();
        private int value;
        [SerializeField] private SpriteRenderer spriteRenderer;

        public static void Spawn(Vector3 position, int value)
        {
            var gem = Pool.Count > 0 ? Pool.Dequeue() : Create();
            gem.transform.position = position;
            gem.value = value;
            gem.gameObject.SetActive(true);
            Active.Add(gem);
        }

        private static ExperienceGem Create()
        {
            var prefab = Resources.Load<GameObject>("Prefabs/ExperienceGem");
            var gameObject = prefab != null ? Instantiate(prefab) : CreateTemplate();
            gameObject.name = "XP Shard";
            var gem = gameObject.GetComponent<ExperienceGem>();
            gem.ResolveVisuals();
            gameObject.transform.localScale = new Vector3(0.34f, 0.5f, 1f);
            gameObject.SetActive(false);
            return gem;
        }

        public static GameObject CreateTemplate()
        {
            var gameObject = new GameObject("ExperienceGem", typeof(SpriteRenderer), typeof(ExperienceGem));
            var gem = gameObject.GetComponent<ExperienceGem>();
            gem.spriteRenderer = gameObject.GetComponent<SpriteRenderer>();
            gem.spriteRenderer.sprite = NeonAssets.DiamondSprite();
            gem.spriteRenderer.color = new Color(0.15f, 1f, 0.95f);
            gem.spriteRenderer.sortingOrder = 5;
            gameObject.transform.localScale = new Vector3(0.34f, 0.5f, 1f);
            return gameObject;
        }

        private void Awake()
        {
            ResolveVisuals();
        }

        private void ResolveVisuals()
        {
            if (spriteRenderer == null) spriteRenderer = GetComponent<SpriteRenderer>();
            if (spriteRenderer != null)
            {
                if (spriteRenderer.sprite == null) spriteRenderer.sprite = NeonAssets.DiamondSprite();
                spriteRenderer.sortingOrder = 5;
            }
        }

        private void Update()
        {
            var player = GameManager.Instance?.Player;
            if (player == null || GameManager.Instance.IsAwaitingStart) return;
            transform.Rotate(0f, 0f, 70f * Time.deltaTime);
            var delta = player.transform.position - transform.position;
            var distance = delta.magnitude;
            if (distance < player.MagnetRadius && distance > 0.01f)
            {
                var speed = Mathf.Lerp(3f, 13f, 1f - distance / player.MagnetRadius);
                transform.position += delta / distance * speed * Time.deltaTime;
            }
            if (distance <= 0.38f) Collect();
        }

        private void Collect()
        {
            Active.Remove(this);
            gameObject.SetActive(false);
            Pool.Enqueue(this);
            GameManager.Instance.AddExperience(value);
        }

        public static void ClearAll()
        {
            foreach (var gem in new List<ExperienceGem>(Active))
            {
                gem.gameObject.SetActive(false);
                Pool.Enqueue(gem);
            }
            Active.Clear();
        }
    }
}
