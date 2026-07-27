using DG.Tweening;
using UnityEngine;

namespace NeonArcana
{
    [RequireComponent(typeof(CanvasGroup))]
    public sealed class UiMotion : MonoBehaviour
    {
        [SerializeField] private float duration = 0.24f;
        [SerializeField] private float startScale = 0.965f;
        private CanvasGroup canvasGroup;
        private RectTransform rectTransform;
        private Sequence sequence;

        private void Awake()
        {
            canvasGroup = GetComponent<CanvasGroup>();
            rectTransform = transform as RectTransform;
        }

        private void OnEnable()
        {
            sequence?.Kill();
            if (canvasGroup != null) canvasGroup.alpha = 0f;
            if (rectTransform != null) rectTransform.localScale = Vector3.one * startScale;
            sequence = DOTween.Sequence().SetUpdate(true);
            if (canvasGroup != null)
                sequence.Join(DOTween.To(() => canvasGroup.alpha, value => canvasGroup.alpha = value, 1f, duration).SetEase(Ease.OutCubic));
            if (rectTransform != null)
                sequence.Join(DOTween.To(() => rectTransform.localScale, value => rectTransform.localScale = value, Vector3.one, duration).SetEase(Ease.OutBack));
        }

        private void OnDisable()
        {
            sequence?.Kill();
            sequence = null;
        }
    }

}
