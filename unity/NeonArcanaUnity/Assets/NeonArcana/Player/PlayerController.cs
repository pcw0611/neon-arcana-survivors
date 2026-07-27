using System;
using UnityEngine;

namespace NeonArcana
{
    public sealed class PlayerController : MonoBehaviour
    {
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
        public bool IsDead => Hp <= 0f;

        public VirtualJoystick MoveJoystick { get; set; }
        public VirtualJoystick AimJoystick { get; set; }

        private SpriteRenderer spriteRenderer;
        private float attackCooldown;
        private float hurtCooldown;
        private Vector2 lastAim = Vector2.right;
        private Vector2 lastMousePosition;
        private bool mouseAimActive;

        public static PlayerController Create()
        {
            var playerObject = new GameObject("Astra", typeof(SpriteRenderer), typeof(PlayerController));
            var controller = playerObject.GetComponent<PlayerController>();
            controller.spriteRenderer = playerObject.GetComponent<SpriteRenderer>();
            controller.spriteRenderer.sprite = NeonAssets.SpriteFrame("Art/astra-sd", 0, 0);
            controller.spriteRenderer.sortingOrder = 20;
            playerObject.transform.localScale = Vector3.one * 0.72f;
            return controller;
        }

        private void Update()
        {
            if (IsDead || GameManager.Instance == null || GameManager.Instance.IsChoosingUpgrade) return;
            Move();
            AimAndFire();
            if (hurtCooldown > 0f) hurtCooldown -= Time.deltaTime;
        }

        private void Move()
        {
            var keyboard = new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical"));
            var input = MoveJoystick != null && MoveJoystick.Value.sqrMagnitude > 0.01f ? MoveJoystick.Value : Vector2.ClampMagnitude(keyboard, 1f);
            transform.position += (Vector3)(input * MoveSpeed * Time.deltaTime);
            if (Mathf.Abs(input.x) > 0.05f) spriteRenderer.flipX = input.x < 0f;
        }

        private void AimAndFire()
        {
            var aim = AimJoystick != null ? AimJoystick.Value : Vector2.zero;
            var currentMousePosition = (Vector2)Input.mousePosition;
            if ((currentMousePosition - lastMousePosition).sqrMagnitude > 1f) mouseAimActive = true;
            lastMousePosition = currentMousePosition;
            if (aim.sqrMagnitude < 0.04f && mouseAimActive && Camera.main != null)
            {
                var mouseWorld = Camera.main.ScreenToWorldPoint(Input.mousePosition);
                var mouseAim = (Vector2)(mouseWorld - transform.position);
                if (mouseAim.sqrMagnitude > 0.25f) aim = mouseAim.normalized;
            }
            if (aim.sqrMagnitude < 0.04f)
            {
                var target = EnemyController.Nearest(transform.position);
                if (target != null) aim = (target.transform.position - transform.position).normalized;
            }
            if (aim.sqrMagnitude > 0.04f) lastAim = aim.normalized;

            attackCooldown -= Time.deltaTime;
            if (attackCooldown > 0f || EnemyController.ActiveCount == 0) return;
            attackCooldown = AttackInterval;
            FireVolley(lastAim);
        }

        private void FireVolley(Vector2 direction)
        {
            var count = Mathf.Max(1, Multishot);
            var totalSpread = Mathf.Min(38f, 8f * (count - 1));
            for (var i = 0; i < count; i++)
            {
                var t = count == 1 ? 0.5f : i / (float)(count - 1);
                var angle = Mathf.Lerp(-totalSpread * 0.5f, totalSpread * 0.5f, t);
                var rotated = Quaternion.Euler(0f, 0f, angle) * direction;
                var critical = UnityEngine.Random.value < CritChance;
                Projectile.Spawn(transform.position + (Vector3)direction * 0.35f, rotated, critical ? Damage * CritMultiplier : Damage, critical);
            }
        }

        public void TakeDamage(float amount)
        {
            if (IsDead || hurtCooldown > 0f) return;
            hurtCooldown = 0.45f;
            Hp = Mathf.Max(0f, Hp - amount);
            GameHud.Instance?.FlashDamage();
            if (Hp <= 0f) Died?.Invoke();
        }

        public void IncreaseVitality(float maxIncrease, float heal)
        {
            MaxHp += maxIncrease;
            Hp = Mathf.Min(MaxHp, Hp + heal);
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
            transform.position = Vector3.zero;
            attackCooldown = 0f;
            hurtCooldown = 0f;
            mouseAimActive = false;
        }
    }
}
