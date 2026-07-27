using UnityEngine;
using UnityEngine.EventSystems;

namespace NeonArcana
{
    public sealed class TouchDragMoveInput : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
    {
        [SerializeField] private VirtualJoystick target;
        [SerializeField] private float fullSpeedDistance = 64f;
        private int activePointerId = int.MinValue;
        private Vector2 startPosition;

        public bool IsConfigured => target != null && fullSpeedDistance > 0f;

        public void Bind(VirtualJoystick joystick)
        {
            target = joystick;
            if (fullSpeedDistance <= 0f) fullSpeedDistance = 64f;
        }

        public void OnPointerDown(PointerEventData eventData)
        {
            if (eventData.pointerId < 0 || !CanMove()) return;
            activePointerId = eventData.pointerId;
            startPosition = eventData.position;
            target?.SetExternalValue(Vector2.zero);
        }

        public void OnDrag(PointerEventData eventData)
        {
            if (eventData.pointerId != activePointerId || target == null) return;
            var delta = eventData.position - startPosition;
            var length = delta.magnitude;
            target.SetExternalValue(delta / Mathf.Max(length, fullSpeedDistance));
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            if (eventData.pointerId != activePointerId) return;
            activePointerId = int.MinValue;
            target?.ReleaseExternal();
        }

        public bool VerifyRouteForTest()
        {
            if (target == null) return false;
            target.SetExternalValue(new Vector2(0.6f, -0.4f));
            var routed = Vector2.Distance(target.Value, new Vector2(0.6f, -0.4f)) < 0.001f;
            target.ReleaseExternal();
            return routed && target.Value == Vector2.zero;
        }

        private static bool CanMove()
        {
            var manager = GameManager.Instance;
            return manager != null && !manager.IsAwaitingStart && !manager.IsChoosingUpgrade
                && !manager.IsGameOver && Time.timeScale > 0f;
        }
    }
}
