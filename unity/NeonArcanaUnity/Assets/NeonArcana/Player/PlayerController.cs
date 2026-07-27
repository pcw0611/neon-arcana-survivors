using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeonArcana
{
    public sealed class PlayerController : MonoBehaviour
    {
        public const string ConstellationTargetingMode = "NearestEnemyAutomatic";

        public event Action Died;

        public float MaxHp { get; private set; } = GameBalance.StartingHp;
        public float Hp { get; private set; } = GameBalance.StartingHp;
        public float MoveSpeed { get; set; } = GameBalance.StartingSpeed;
        public float Damage { get; set; } = GameBalance.StartingDamage;
        public float AttackInterval { get; set; } = GameBalance.StartingAttackInterval;
        public int Multishot { get; set; } = GameBalance.StartingMultishot;
        public float MagnetRadius { get; set; } = GameBalance.BaseMagnetRadius;
        public float CritChance { get; set; } = GameBalance.StartingCritChance;
        public float CritMultiplier { get; set; } = GameBalance.StartingCritMultiplier;
        public int Pierce { get; set; }
        public float BlastRadius { get; set; }
        public int ChainCount { get; set; }
        public float ProjectileScale { get; set; } = 1f;
        public float ProjectileMultiplier { get; set; } = 1f;
        public int Orbitals { get; set; }
        public float OrbitSpeed { get; set; } = 1f;
        public float OrbitSize { get; set; } = 1f;
        public float OrbitRadius { get; set; } = 1.35f;
        public float OrbitDamage { get; set; } = 1f;
        public float OrbitShock { get; set; }
        public float OrbitGuard { get; set; }
        public int OrbitPulse { get; set; }
        public int SaberLevel { get; set; }
        public float SaberDamage { get; set; } = 1f;
        public float SaberRange { get; set; } = 2.2f;
        public float SaberInterval { get; set; } = 1.1f;
        public int SaberEcho { get; set; }
        public float SaberGuard { get; set; }
        public float SaberArc { get; set; } = 1.38f;
        public float Regen { get; set; }
        public float GuardChance { get; set; }
        public float XpMultiplier { get; set; } = 1f;
        public float DamageMultiplier { get; set; } = 1f;
        public ArcanaClass Class { get; private set; }
        public int RelicSlots { get; set; } = 3;
        public bool IsDead => Hp <= 0f;
        public Vector2 LastProjectileDirection { get; private set; } = Vector2.right;

        public VirtualJoystick MoveJoystick { get; set; }

        [SerializeField] private SpriteRenderer spriteRenderer;
        [SerializeField] private SpriteRenderer classDecoration;
        [SerializeField] private SpriteRenderer auraRenderer;
        [SerializeField] private SpriteRenderer hpBackRenderer;
        [SerializeField] private SpriteRenderer hpFillRenderer;
        [SerializeField] private SpriteRenderer hitboxRenderer;
        private float attackCooldown;
        private float hurtCooldown;
        private Vector2 lastAim = Vector2.right;
        private Vector2 saberAim = Vector2.right;
        private Vector2 moveDirection;
        private Vector2 lastMousePosition;
        private bool mouseAimActive;
        private float animationClock;
        private int animationFrame;
        private float saberCooldown;
        private float regenClock;
        private float classClock;
        private readonly List<GameObject> orbitalObjects = new();
        private readonly List<EnemyController> targetBuffer = new();
        private int volleyCount;

        public static PlayerController Create()
        {
            var prefab = Resources.Load<GameObject>("Prefabs/Player");
            var playerObject = prefab != null ? Instantiate(prefab) : CreateTemplate();
            playerObject.name = "Astra";
            var controller = playerObject.GetComponent<PlayerController>();
            controller.ResolveVisuals();
            return controller;
        }

        public static GameObject CreateTemplate()
        {
            var playerObject = new GameObject("Player", typeof(SpriteRenderer), typeof(PlayerController));
            var controller = playerObject.GetComponent<PlayerController>();
            controller.spriteRenderer = playerObject.GetComponent<SpriteRenderer>();
            controller.spriteRenderer.sprite = NeonAssets.SpriteFrame("Art/astra-sd", 0, 0);
            controller.spriteRenderer.sortingOrder = 20;
            playerObject.transform.localScale = Vector3.one * 0.78f;

            var aura = new GameObject("Aura", typeof(SpriteRenderer));
            aura.transform.SetParent(playerObject.transform, false);
            aura.transform.localScale = Vector3.one * 1.65f;
            controller.auraRenderer = aura.GetComponent<SpriteRenderer>();
            controller.auraRenderer.sprite = NeonAssets.GlowSprite();
            controller.auraRenderer.color = new Color(0.15f, 0.95f, 1f, 0.22f);
            controller.auraRenderer.sortingOrder = 19;

            var decoration = new GameObject("Class Decoration", typeof(SpriteRenderer));
            decoration.transform.SetParent(playerObject.transform, false);
            controller.classDecoration = decoration.GetComponent<SpriteRenderer>();
            controller.classDecoration.sortingOrder = 21;
            controller.classDecoration.enabled = false;

            var hpBack = new GameObject("HP Back", typeof(SpriteRenderer));
            hpBack.transform.SetParent(playerObject.transform, false);
            hpBack.transform.localPosition = new Vector3(0f, -0.72f, 0f);
            hpBack.transform.localScale = new Vector3(0.98f, 0.1f, 1f);
            controller.hpBackRenderer = hpBack.GetComponent<SpriteRenderer>();
            controller.hpBackRenderer.sprite = NeonAssets.SolidSprite(Color.white);
            controller.hpBackRenderer.color = new Color(0.015f, 0.025f, 0.055f, 0.94f);
            controller.hpBackRenderer.sortingOrder = 22;

            var hpFill = new GameObject("HP Fill", typeof(SpriteRenderer));
            hpFill.transform.SetParent(playerObject.transform, false);
            hpFill.transform.localPosition = new Vector3(0f, -0.72f, 0f);
            hpFill.transform.localScale = new Vector3(0.92f, 0.055f, 1f);
            controller.hpFillRenderer = hpFill.GetComponent<SpriteRenderer>();
            controller.hpFillRenderer.sprite = NeonAssets.SolidSprite(Color.white);
            controller.hpFillRenderer.color = new Color(0.24f, 1f, 0.66f, 1f);
            controller.hpFillRenderer.sortingOrder = 23;

            var hitbox = new GameObject("Hitbox Debug", typeof(SpriteRenderer));
            hitbox.transform.SetParent(playerObject.transform, false);
            hitbox.transform.localScale = Vector3.one * 0.9f;
            controller.hitboxRenderer = hitbox.GetComponent<SpriteRenderer>();
            controller.hitboxRenderer.sprite = NeonAssets.RingSprite(128);
            controller.hitboxRenderer.color = new Color(1f, 0.2f, 0.32f, 0.9f);
            controller.hitboxRenderer.sortingOrder = 24;
            controller.hitboxRenderer.enabled = false;
            return playerObject;
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
                if (spriteRenderer.sprite == null) spriteRenderer.sprite = NeonAssets.SpriteFrame("Art/astra-sd", 0, 0);
                spriteRenderer.sortingOrder = 20;
            }
            var decoration = transform.Find("Class Decoration");
            if (classDecoration == null && decoration != null) classDecoration = decoration.GetComponent<SpriteRenderer>();
            var aura = transform.Find("Aura");
            if (auraRenderer == null && aura != null) auraRenderer = aura.GetComponent<SpriteRenderer>();
            if (auraRenderer != null && auraRenderer.sprite == null) auraRenderer.sprite = NeonAssets.GlowSprite();
            var hpBack = transform.Find("HP Back");
            if (hpBackRenderer == null && hpBack != null) hpBackRenderer = hpBack.GetComponent<SpriteRenderer>();
            if (hpBackRenderer != null && hpBackRenderer.sprite == null) hpBackRenderer.sprite = NeonAssets.SolidSprite(Color.white);
            var hpFill = transform.Find("HP Fill");
            if (hpFillRenderer == null && hpFill != null) hpFillRenderer = hpFill.GetComponent<SpriteRenderer>();
            if (hpFillRenderer != null && hpFillRenderer.sprite == null) hpFillRenderer.sprite = NeonAssets.SolidSprite(Color.white);
            var hitbox = transform.Find("Hitbox Debug");
            if (hitboxRenderer == null && hitbox != null) hitboxRenderer = hitbox.GetComponent<SpriteRenderer>();
            if (hitboxRenderer != null && hitboxRenderer.sprite == null) hitboxRenderer.sprite = NeonAssets.RingSprite(128);
        }

        public void SetHitboxVisible(bool visible)
        {
            if (hitboxRenderer != null) hitboxRenderer.enabled = visible;
        }

        private void Update()
        {
            if (IsDead || GameManager.Instance == null || GameManager.Instance.IsChoosingUpgrade || GameManager.Instance.IsAwaitingStart) return;
            Move();
            AimAndFire();
            UpdateSaber();
            UpdateOrbitals();
            UpdateAnimation();
            UpdateRegeneration();
            UpdateClassAbility();
            UpdateHpBar();
            if (hurtCooldown > 0f) hurtCooldown -= Time.deltaTime;
        }

        private void Move()
        {
            var keyboard = new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical"));
            var input = MoveJoystick != null && MoveJoystick.Value.sqrMagnitude > 0.01f ? MoveJoystick.Value : Vector2.ClampMagnitude(keyboard, 1f);
            moveDirection = input.sqrMagnitude > 0.01f ? input.normalized : Vector2.zero;
            transform.position += (Vector3)(input * MoveSpeed * Time.deltaTime);
            if (Mathf.Abs(input.x) > 0.05f) spriteRenderer.flipX = input.x < 0f;
            animationClock += input.sqrMagnitude > 0.01f ? Time.deltaTime * 8f : Time.deltaTime * 2f;
        }

        private void AimAndFire()
        {
            UpdateSaberAim();

            attackCooldown -= Time.deltaTime;
            if (attackCooldown > 0f || EnemyController.ActiveCount == 0) return;
            var target = EnemyController.Nearest(transform.position);
            if (target == null) return;
            var direction = (Vector2)(target.transform.position - transform.position);
            if (direction.sqrMagnitude < 0.001f) return;
            lastAim = direction.normalized;
            LastProjectileDirection = lastAim;
            attackCooldown = Class == ArcanaClass.SilverBullet ? Mathf.Max(0.1f, AttackInterval * 0.4f) : AttackInterval;
            FireVolley(lastAim);
        }

        private void UpdateSaberAim()
        {
            var currentMousePosition = (Vector2)Input.mousePosition;
            if ((currentMousePosition - lastMousePosition).sqrMagnitude > 1f) mouseAimActive = true;
            lastMousePosition = currentMousePosition;
            if (mouseAimActive && Camera.main != null)
            {
                var mouseWorld = Camera.main.ScreenToWorldPoint(Input.mousePosition);
                var mouseAim = (Vector2)(mouseWorld - transform.position);
                if (mouseAim.sqrMagnitude > 0.25f) saberAim = mouseAim.normalized;
            }
            else if (moveDirection.sqrMagnitude > 0.04f)
            {
                saberAim = moveDirection;
            }
        }

        private void FireVolley(Vector2 direction)
        {
            volleyCount++;
            var bonus = GameManager.Instance.HasRelic("split_core") && volleyCount % 4 == 0 ? 2 : 0;
            var count = Mathf.Max(1, Multishot + bonus);
            if (Class == ArcanaClass.SilverBullet) count = Mathf.Max(2, count * 2);
            var totalSpread = Mathf.Min(38f, 8f * (count - 1));
            for (var i = 0; i < count; i++)
            {
                var t = count == 1 ? 0.5f : i / (float)(count - 1);
                var angle = Class == ArcanaClass.SilverBullet ? UnityEngine.Random.Range(-2.5f, 2.5f) : Mathf.Lerp(-totalSpread * 0.5f, totalSpread * 0.5f, t);
                var rotated = Quaternion.Euler(0f, 0f, angle) * direction;
                var critical = UnityEngine.Random.value < CritChance;
                var shotDamage = Damage * DamageMultiplier * ProjectileMultiplier * (critical ? CritMultiplier : 1f);
                Projectile.Spawn(transform.position + (Vector3)direction * 0.35f, rotated, shotDamage, critical, this, Class == ArcanaClass.SilverBullet);
            }
            if (GameManager.Instance.HasRelic("echo_chamber") && volleyCount % 6 == 0)
                Invoke(nameof(FireEchoVolley), 0.12f);
        }

        private void FireEchoVolley() => FireVolley(lastAim);

        public void TakeDamage(float amount)
        {
            if (IsDead || hurtCooldown > 0f) return;
            if (UnityEngine.Random.value < Mathf.Clamp01(GuardChance + (saberCooldown > 0f ? SaberGuard : 0f))) return;
            hurtCooldown = 0.45f;
            Hp = Mathf.Max(0f, Hp - amount);
            GameHud.Instance?.FlashDamage();
            if (Hp <= 0f)
            {
                if (GameManager.Instance.TryPhoenixRevive())
                {
                    Hp = MaxHp * 0.4f;
                    hurtCooldown = 2.5f;
                    return;
                }
                Died?.Invoke();
            }
        }

        public void IncreaseVitality(float maxIncrease, float heal)
        {
            MaxHp += maxIncrease;
            Hp = Mathf.Min(MaxHp, Hp + heal);
        }

        public void Heal(float amount) => Hp = Mathf.Min(MaxHp, Hp + amount);

        public void SetClass(ArcanaClass selected)
        {
            Class = selected;
            classDecoration.enabled = selected != ArcanaClass.None && selected != ArcanaClass.Wanderer;
            classDecoration.transform.localPosition = new Vector3(0f, 0.28f, 0f);
            classDecoration.transform.localScale = Vector3.one * 0.65f;
            switch (selected)
            {
                case ArcanaClass.SilverBullet:
                    classDecoration.sprite = NeonAssets.FullSprite("Art/silver-bullet", 180f);
                    ProjectileScale *= 0.22f;
                    ProjectileMultiplier *= 0.82f;
                    break;
                case ArcanaClass.ShadowMaster:
                    classDecoration.sprite = NeonAssets.FullSprite("Art/dark-blade", 160f);
                    SaberLevel = Mathf.Max(1, SaberLevel);
                    SaberDamage *= 1.3f;
                    SaberRange *= 0.8f;
                    break;
                case ArcanaClass.Mechanic:
                    classDecoration.sprite = NeonAssets.FullSprite("Art/mecha-orbital", 120f);
                    Orbitals = Mathf.Max(2, Orbitals);
                    break;
                case ArcanaClass.Thor:
                    classDecoration.sprite = NeonAssets.FullSprite("Art/thor-hammer", 300f);
                    ChainCount = Mathf.Max(1, ChainCount);
                    break;
                case ArcanaClass.Wanderer:
                    IncreaseVitality(5f, 5f);
                    break;
            }
        }

        private void UpdateAnimation()
        {
            var next = Mathf.FloorToInt(animationClock) % 2;
            if (next == animationFrame) return;
            animationFrame = next;
            spriteRenderer.sprite = NeonAssets.SpriteFrame("Art/astra-sd", animationFrame, 0);
            if (auraRenderer != null)
            {
                var pulse = 1.55f + Mathf.Sin(Time.time * 3.2f) * 0.12f;
                auraRenderer.transform.localScale = Vector3.one * pulse;
                auraRenderer.transform.localRotation = Quaternion.Euler(0f, 0f, Time.time * 9f);
            }
        }

        private void UpdateRegeneration()
        {
            if (Regen <= 0f) return;
            regenClock += Time.deltaTime;
            if (regenClock < 1f) return;
            regenClock -= 1f;
            Heal(Regen);
        }

        private void UpdateSaber()
        {
            if (SaberLevel <= 0) return;
            saberCooldown -= Time.deltaTime;
            if (saberCooldown > 0f) return;
            saberCooldown = Mathf.Max(0.2f, SaberInterval);
            var range = SaberRange / 100f + 1.6f;
            EnemyController.Nearby(transform.position, range, targetBuffer);
            var remainingHits = 2 + SaberEcho;
            var minimumDot = Mathf.Cos(SaberArc * 0.5f);
            for (var i = 0; i < targetBuffer.Count && remainingHits > 0; i++)
            {
                var target = targetBuffer[i];
                var toTarget = (Vector2)(target.transform.position - transform.position);
                if (toTarget.sqrMagnitude > 0.08f && Vector2.Dot(saberAim, toTarget.normalized) < minimumDot) continue;
                target.TakeDamage(Damage * DamageMultiplier * SaberDamage * (Class == ArcanaClass.ShadowMaster && target.IsBoss ? 1.3f : 1f), false);
                remainingHits--;
            }
            CombatPulse.SpawnArc(transform.position, range, saberAim, SaberArc, new Color(0.35f, 0.92f, 1f, 0.78f));
        }

        private void UpdateHpBar()
        {
            if (hpFillRenderer == null) return;
            var ratio = MaxHp <= 0f ? 0f : Mathf.Clamp01(Hp / MaxHp);
            var scale = hpFillRenderer.transform.localScale;
            scale.x = 0.92f * ratio;
            hpFillRenderer.transform.localScale = scale;
            hpFillRenderer.transform.localPosition = new Vector3(-0.46f + scale.x * 0.5f, -0.72f, 0f);
        }

        private void UpdateOrbitals()
        {
            while (orbitalObjects.Count < Orbitals)
            {
                var orbital = new GameObject("Arcana Orbital", typeof(SpriteRenderer));
                var renderer = orbital.GetComponent<SpriteRenderer>();
                renderer.sprite = NeonAssets.SolidSprite(Color.white);
                renderer.color = new Color(0.2f, 0.95f, 1f);
                renderer.sortingOrder = 18;
                orbitalObjects.Add(orbital);
            }
            for (var i = 0; i < orbitalObjects.Count; i++)
            {
                var active = i < Orbitals;
                orbitalObjects[i].SetActive(active);
                if (!active) continue;
                var angle = Time.time * 120f * OrbitSpeed + i * 360f / Mathf.Max(1, Orbitals);
                var direction = Quaternion.Euler(0f, 0f, angle) * Vector3.right;
                orbitalObjects[i].transform.position = transform.position + direction * OrbitRadius;
                orbitalObjects[i].transform.localScale = Vector3.one * 0.17f * OrbitSize;
                var target = EnemyController.FirstWithin(orbitalObjects[i].transform.position, 0.28f * OrbitSize);
                if (target != null) target.TakeDamage(Damage * DamageMultiplier * OrbitDamage * Time.deltaTime * 3f, false);
            }
        }

        private void UpdateClassAbility()
        {
            classClock += Time.deltaTime;
            if (Class == ArcanaClass.ShadowMaster)
            {
                var hidden = classClock % 7f > 5.8f;
                spriteRenderer.color = hidden ? new Color(0.5f, 0.25f, 0.8f, 0.35f) : Color.white;
            }
            else
            {
                spriteRenderer.color = Color.white;
            }
            if (Class == ArcanaClass.Thor && classClock >= 6f)
            {
                classClock = 0f;
                var target = EnemyController.HighestHp();
                if (target != null)
                {
                    target.TakeDamage(Damage * DamageMultiplier * 15f, true);
                    CombatPulse.Spawn(target.transform.position, 1.2f, Color.yellow);
                }
            }
        }

        public void ResetForRun()
        {
            MaxHp = GameBalance.StartingHp;
            Hp = MaxHp;
            MoveSpeed = GameBalance.StartingSpeed;
            Damage = GameBalance.StartingDamage;
            AttackInterval = GameBalance.StartingAttackInterval;
            Multishot = GameBalance.StartingMultishot;
            MagnetRadius = GameBalance.BaseMagnetRadius;
            CritChance = GameBalance.StartingCritChance;
            CritMultiplier = GameBalance.StartingCritMultiplier;
            Pierce = 0;
            BlastRadius = 0f;
            ChainCount = 0;
            ProjectileScale = ProjectileMultiplier = 1f;
            Orbitals = 0;
            OrbitSpeed = OrbitSize = OrbitDamage = 1f;
            OrbitRadius = 1.35f;
            OrbitShock = OrbitGuard = 0f;
            OrbitPulse = 0;
            SaberLevel = SaberEcho = 0;
            SaberDamage = 1f;
            SaberRange = 2.2f;
            SaberInterval = 1.1f;
            SaberGuard = Regen = GuardChance = 0f;
            SaberArc = 1.38f;
            XpMultiplier = DamageMultiplier = 1f;
            RelicSlots = 3;
            Class = ArcanaClass.None;
            if (classDecoration != null) classDecoration.enabled = false;
            foreach (var orbital in orbitalObjects) orbital.SetActive(false);
            transform.position = Vector3.zero;
            attackCooldown = 0f;
            hurtCooldown = 0f;
            mouseAimActive = false;
            moveDirection = Vector2.zero;
            saberAim = LastProjectileDirection = lastAim = Vector2.right;
            animationClock = saberCooldown = regenClock = classClock = 0f;
            volleyCount = 0;
            UpdateHpBar();
        }
    }
}
