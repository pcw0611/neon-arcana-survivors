using System.Collections.Generic;
using UnityEngine;

namespace NeonArcana
{
    public sealed class EnemyController : MonoBehaviour
    {
        private static readonly List<EnemyController> Active = new();
        private static readonly Queue<EnemyController> Pool = new();

        public static int ActiveCount => Active.Count;

        private float hp;
        private float speed;
        private float damage;
        private float contactCooldown;
        private SpriteRenderer spriteRenderer;

        public static EnemyController Spawn(Vector3 position, float difficulty)
        {
            var enemy = Pool.Count > 0 ? Pool.Dequeue() : Create();
            enemy.transform.position = position;
            enemy.hp = 5.5f * difficulty;
            enemy.speed = Mathf.Min(2.7f, 1.35f + GameManager.Instance.Elapsed * 0.002f);
            enemy.damage = 2f + GameManager.Instance.Elapsed / 145f;
            enemy.contactCooldown = 0f;
            enemy.gameObject.SetActive(true);
            Active.Add(enemy);
            return enemy;
        }

        private static EnemyController Create()
        {
            var gameObject = new GameObject("Shade", typeof(SpriteRenderer), typeof(EnemyController));
            var enemy = gameObject.GetComponent<EnemyController>();
            enemy.spriteRenderer = gameObject.GetComponent<SpriteRenderer>();
            enemy.spriteRenderer.sprite = NeonAssets.SpriteFrame("Art/shade-sd", 0, 0);
            enemy.spriteRenderer.color = new Color(1f, 0.45f, 0.85f);
            enemy.spriteRenderer.sortingOrder = 10;
            gameObject.transform.localScale = Vector3.one * 0.56f;
            gameObject.SetActive(false);
            return enemy;
        }

        private void Update()
        {
            var player = GameManager.Instance?.Player;
            if (player == null || player.IsDead) return;
            var delta = player.transform.position - transform.position;
            var distance = delta.magnitude;
            if (distance > 0.001f) transform.position += delta / distance * speed * Time.deltaTime;
            if (delta.x != 0f) spriteRenderer.flipX = delta.x < 0f;
            contactCooldown -= Time.deltaTime;
            if (distance <= 0.55f && contactCooldown <= 0f)
            {
                contactCooldown = 0.9f;
                player.TakeDamage(damage);
            }
        }

        public void TakeDamage(float amount, bool critical)
        {
            hp -= amount;
            spriteRenderer.color = critical ? new Color(1f, 0.9f, 0.2f) : Color.white;
            CancelInvoke(nameof(RestoreColor));
            Invoke(nameof(RestoreColor), 0.07f);
            if (hp <= 0f) Die();
        }

        private void RestoreColor() => spriteRenderer.color = new Color(1f, 0.45f, 0.85f);

        private void Die()
        {
            var deathPosition = transform.position;
            Active.Remove(this);
            gameObject.SetActive(false);
            Pool.Enqueue(this);
            GameManager.Instance.RegisterKill(deathPosition, 1);
        }

        public static EnemyController Nearest(Vector3 position)
        {
            EnemyController best = null;
            var bestDistance = float.MaxValue;
            foreach (var enemy in Active)
            {
                var distance = (enemy.transform.position - position).sqrMagnitude;
                if (distance >= bestDistance) continue;
                bestDistance = distance;
                best = enemy;
            }
            return best;
        }

        public static EnemyController FirstWithin(Vector3 position, float radius)
        {
            var radiusSquared = radius * radius;
            foreach (var enemy in Active)
            {
                if ((enemy.transform.position - position).sqrMagnitude <= radiusSquared) return enemy;
            }
            return null;
        }

        public static void ClearAll()
        {
            foreach (var enemy in new List<EnemyController>(Active))
            {
                enemy.gameObject.SetActive(false);
                Pool.Enqueue(enemy);
            }
            Active.Clear();
        }
    }

    public sealed class EnemySpawner : MonoBehaviour
    {
        private float spawnTimer;

        private void Update()
        {
            var manager = GameManager.Instance;
            if (manager == null || manager.IsGameOver || manager.IsChoosingUpgrade || EnemyController.ActiveCount >= GameBalance.EnemyCap) return;
            spawnTimer -= Time.deltaTime;
            if (spawnTimer > 0f) return;

            var targetDensity = Mathf.Min(75, Mathf.RoundToInt((12f + manager.Elapsed * 0.15f) * Mathf.Lerp(0.7f, 1f, Mathf.Clamp01(manager.Elapsed / 60f))));
            var deficit = Mathf.Max(1, targetDensity - EnemyController.ActiveCount);
            var batch = Mathf.Clamp(Mathf.CeilToInt(deficit * 0.12f), 1, 5);
            for (var i = 0; i < batch; i++) SpawnAtEdge();
            spawnTimer = Mathf.Max(0.12f, 0.7f - manager.Elapsed * 0.0015f);
        }

        private static void SpawnAtEdge()
        {
            var player = GameManager.Instance.Player;
            var angle = Random.value * Mathf.PI * 2f;
            var distance = Random.Range(7.5f, 9.5f);
            var position = player.transform.position + new Vector3(Mathf.Cos(angle), Mathf.Sin(angle)) * distance;
            EnemyController.Spawn(position, GameBalance.DifficultyScale(GameManager.Instance.Elapsed));
        }
    }
}
