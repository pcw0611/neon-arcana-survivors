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
        private int pierce;
        private float hitRadius;
        private float blastRadius;
        private int chainCount;
        private PlayerController owner;
        private bool accelerates;
        private readonly HashSet<EnemyController> hitEnemies = new();
        private readonly List<EnemyController> nearby = new();
        private SpriteRenderer spriteRenderer;
        private TrailRenderer trail;

        public static void Spawn(Vector3 position, Vector2 direction, float damage, bool critical, PlayerController owner = null, bool accelerates = false)
        {
            var projectile = Pool.Count > 0 ? Pool.Dequeue() : Create();
            projectile.transform.position = position;
            projectile.direction = direction.normalized;
            projectile.damage = damage;
            projectile.critical = critical;
            projectile.owner = owner;
            projectile.pierce = owner?.Pierce ?? 0;
            projectile.hitRadius = 0.34f * (owner?.ProjectileScale ?? 1f);
            projectile.blastRadius = (owner?.BlastRadius ?? 0f) / 100f;
            projectile.chainCount = owner?.ChainCount ?? 0;
            projectile.accelerates = accelerates;
            projectile.hitEnemies.Clear();
            projectile.life = 1.8f;
            projectile.gameObject.SetActive(true);
            projectile.spriteRenderer.color = critical ? new Color(1f, 0.75f, 0.2f) : new Color(0.2f, 0.95f, 1f);
            projectile.trail.Clear();
            projectile.transform.localScale = new Vector3(0.28f, 0.1f, 1f) * (owner?.ProjectileScale ?? 1f);
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
            var speed = accelerates ? Mathf.Lerp(18f, 28f, 1f - life / 1.8f) : 12f;
            transform.position += (Vector3)(direction * speed * Time.deltaTime);
            transform.right = direction;
            life -= Time.deltaTime;
            var enemy = EnemyController.FirstWithin(transform.position, hitRadius, hitEnemies);
            if (enemy != null)
            {
                hitEnemies.Add(enemy);
                enemy.TakeDamage(damage, critical);
                ApplySecondaryEffects(enemy);
                if (pierce-- <= 0) Recycle();
            }
            else if (life <= 0f)
            {
                Recycle();
            }
        }

        private void ApplySecondaryEffects(EnemyController primary)
        {
            if (blastRadius > 0f)
            {
                EnemyController.Nearby(primary.transform.position, blastRadius, nearby);
                foreach (var enemy in nearby)
                    if (enemy != primary) enemy.TakeDamage(damage * 0.35f, false);
                CombatPulse.Spawn(primary.transform.position, blastRadius, new Color(0.25f, 0.85f, 1f, 0.45f));
            }
            var totalChain = owner != null && owner.Class == ArcanaClass.Thor ? Mathf.Max(chainCount, 1) : chainCount;
            if (totalChain <= 0) return;
            EnemyController.Nearby(primary.transform.position, owner != null && owner.Class == ArcanaClass.Thor ? 2.4f : 2.1f, nearby);
            var hits = 0;
            foreach (var enemy in nearby)
            {
                if (enemy == primary) continue;
                enemy.TakeDamage(damage * (owner != null && owner.Class == ArcanaClass.Thor ? 0.4f : 0.28f), false);
                CombatPulse.Spawn(enemy.transform.position, 0.28f, owner != null && owner.Class == ArcanaClass.Thor ? Color.yellow : Color.cyan);
                if (++hits >= totalChain) break;
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

    public sealed class CombatPulse : MonoBehaviour
    {
        private static readonly Queue<CombatPulse> Pool = new();
        private float life;
        private float maximumLife;
        private float radius;
        private SpriteRenderer renderer;

        public static void Spawn(Vector3 position, float radius, Color color)
        {
            var pulse = Pool.Count > 0 ? Pool.Dequeue() : Create();
            pulse.transform.position = position;
            pulse.radius = Mathf.Max(0.15f, radius);
            pulse.life = pulse.maximumLife = 0.24f;
            pulse.renderer.color = color;
            pulse.gameObject.SetActive(true);
        }

        private static CombatPulse Create()
        {
            var gameObject = new GameObject("Combat Pulse", typeof(SpriteRenderer), typeof(CombatPulse));
            var pulse = gameObject.GetComponent<CombatPulse>();
            pulse.renderer = gameObject.GetComponent<SpriteRenderer>();
            pulse.renderer.sprite = NeonAssets.SolidSprite(Color.white);
            pulse.renderer.sortingOrder = 14;
            gameObject.SetActive(false);
            return pulse;
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
