using System.Collections.Generic;
using UnityEngine;

namespace NeonArcana
{
    public sealed class ExperienceGem : MonoBehaviour
    {
        private static readonly List<ExperienceGem> Active = new();
        private static readonly Queue<ExperienceGem> Pool = new();
        private int value;

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
            var gameObject = new GameObject("XP Shard", typeof(SpriteRenderer), typeof(ExperienceGem));
            var renderer = gameObject.GetComponent<SpriteRenderer>();
            renderer.sprite = NeonAssets.SolidSprite(Color.white);
            renderer.color = new Color(0.15f, 1f, 0.95f);
            renderer.sortingOrder = 5;
            gameObject.transform.localScale = new Vector3(0.16f, 0.24f, 1f);
            var gem = gameObject.GetComponent<ExperienceGem>();
            gameObject.SetActive(false);
            return gem;
        }

        private void Update()
        {
            var player = GameManager.Instance?.Player;
            if (player == null) return;
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
