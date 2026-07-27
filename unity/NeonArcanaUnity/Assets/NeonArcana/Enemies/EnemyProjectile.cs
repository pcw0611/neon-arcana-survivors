using System.Collections.Generic;
using UnityEngine;

namespace NeonArcana
{
    public sealed class EnemyProjectile : MonoBehaviour
    {
        private static readonly Queue<EnemyProjectile> Pool = new();
        private static readonly HashSet<EnemyProjectile> Live = new();
        private Vector2 velocity;
        private float damage;
        private float life;
        private bool mine;
        private float warmup;
        private SpriteRenderer renderer;

        public static void Spawn(Vector3 position, Vector2 direction, float speed, float damage, bool mine = false)
        {
            var shot = Pool.Count > 0 ? Pool.Dequeue() : Create();
            shot.transform.position = position;
            shot.velocity = direction.normalized * speed;
            shot.damage = damage;
            shot.life = mine ? 2.1f : 6f;
            shot.warmup = mine ? 1.05f : 0f;
            shot.mine = mine;
            shot.renderer.color = mine ? new Color(1f, 0.2f, 0.38f, 0.45f) : new Color(1f, 0.25f, 0.65f);
            shot.transform.localScale = Vector3.one * (mine ? 0.7f : 0.14f);
            shot.gameObject.SetActive(true);
            Live.Add(shot);
        }

        private static EnemyProjectile Create()
        {
            var gameObject = new GameObject("Enemy Projectile", typeof(SpriteRenderer), typeof(EnemyProjectile));
            var shot = gameObject.GetComponent<EnemyProjectile>();
            shot.renderer = gameObject.GetComponent<SpriteRenderer>();
            shot.renderer.sprite = NeonAssets.FullSprite("Art/enemy-missile", 100f) ?? NeonAssets.SolidSprite(Color.white);
            shot.renderer.sortingOrder = 16;
            gameObject.SetActive(false);
            return shot;
        }

        private void Update()
        {
            var player = GameManager.Instance?.Player;
            if (player == null) return;
            life -= Time.deltaTime;
            warmup -= Time.deltaTime;
            if (!mine) transform.position += (Vector3)(velocity * Time.deltaTime);
            if (mine && warmup <= 0f)
            {
                if (Vector3.Distance(transform.position, player.transform.position) < 0.85f) player.TakeDamage(damage);
                CombatPulse.Spawn(transform.position, 0.85f, new Color(1f, 0.2f, 0.4f, 0.6f));
                Recycle();
                return;
            }
            if (!mine && Vector3.Distance(transform.position, player.transform.position) < 0.38f)
            {
                player.TakeDamage(damage);
                Recycle();
            }
            else if (life <= 0f) Recycle();
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
            foreach (var shot in new List<EnemyProjectile>(Live)) shot.Recycle();
        }
    }
}
