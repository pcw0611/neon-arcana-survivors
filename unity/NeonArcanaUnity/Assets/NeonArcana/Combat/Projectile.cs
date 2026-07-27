using System.Collections.Generic;
using UnityEngine;

namespace NeonArcana
{
    public sealed class Projectile : MonoBehaviour
    {
        private static readonly Queue<Projectile> Pool = new();
        private static readonly HashSet<Projectile> Live = new();

        private Vector2 direction;
        private float damage;
        private float life;
        private bool critical;
        private SpriteRenderer spriteRenderer;
        private TrailRenderer trail;

        public static void Spawn(Vector3 position, Vector2 direction, float damage, bool critical)
        {
            var projectile = Pool.Count > 0 ? Pool.Dequeue() : Create();
            projectile.transform.position = position;
            projectile.direction = direction.normalized;
            projectile.damage = damage;
            projectile.critical = critical;
            projectile.life = 1.8f;
            projectile.gameObject.SetActive(true);
            projectile.spriteRenderer.color = critical ? new Color(1f, 0.75f, 0.2f) : new Color(0.2f, 0.95f, 1f);
            projectile.trail.Clear();
            Live.Add(projectile);
        }

        private static Projectile Create()
        {
            var gameObject = new GameObject("Arc Bolt", typeof(SpriteRenderer), typeof(TrailRenderer), typeof(Projectile));
            var projectile = gameObject.GetComponent<Projectile>();
            projectile.spriteRenderer = gameObject.GetComponent<SpriteRenderer>();
            projectile.spriteRenderer.sprite = NeonAssets.SolidSprite(Color.white);
            projectile.spriteRenderer.sortingOrder = 15;
            gameObject.transform.localScale = new Vector3(0.28f, 0.1f, 1f);
            projectile.trail = gameObject.GetComponent<TrailRenderer>();
            projectile.trail.time = 0.12f;
            projectile.trail.startWidth = 0.12f;
            projectile.trail.endWidth = 0f;
            projectile.trail.material = new Material(Shader.Find("Sprites/Default"));
            projectile.trail.startColor = new Color(0.2f, 0.95f, 1f, 0.8f);
            projectile.trail.endColor = new Color(0.8f, 0.2f, 1f, 0f);
            return projectile;
        }

        private void Update()
        {
            transform.position += (Vector3)(direction * 12f * Time.deltaTime);
            transform.right = direction;
            life -= Time.deltaTime;
            var enemy = EnemyController.FirstWithin(transform.position, 0.34f);
            if (enemy != null)
            {
                enemy.TakeDamage(damage, critical);
                Recycle();
            }
            else if (life <= 0f)
            {
                Recycle();
            }
        }

        private void Recycle()
        {
            if (!gameObject.activeSelf) return;
            gameObject.SetActive(false);
            Live.Remove(this);
            Pool.Enqueue(this);
        }

        public static void ClearAll()
        {
            foreach (var projectile in new List<Projectile>(Live)) projectile.Recycle();
        }
    }
}
