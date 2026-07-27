using DG.Tweening;
using UnityEngine;

namespace NeonArcana
{
    public sealed class NeonPulse : MonoBehaviour
    {
        [SerializeField] private float amount = 0.025f;
        [SerializeField] private float speed = 2.4f;
        private Vector3 baseScale;
        private Tween tween;

        private void OnEnable()
        {
            baseScale = transform.localScale;
            tween?.Kill();
            tween = DOTween.To(
                    () => transform.localScale,
                    value => transform.localScale = value,
                    baseScale * (1f + amount),
                    Mathf.Max(0.15f, 1f / speed))
                .SetEase(Ease.InOutSine)
                .SetLoops(-1, LoopType.Yoyo)
                .SetUpdate(true);
        }

        private void OnDisable()
        {
            tween?.Kill();
            tween = null;
            transform.localScale = baseScale;
        }
    }
}
