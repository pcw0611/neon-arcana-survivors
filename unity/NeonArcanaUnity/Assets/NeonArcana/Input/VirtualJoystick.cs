using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace NeonArcana
{
    public sealed class VirtualJoystick : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
    {
        public Vector2 Value { get; private set; }
        public bool IsHeld { get; private set; }

        private RectTransform background;
        private RectTransform handle;
        private float radius;

        public static VirtualJoystick Create(Transform parent, string name, Vector2 anchor, Color color)
        {
            var root = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image), typeof(VirtualJoystick));
            root.transform.SetParent(parent, false);
            var rect = root.GetComponent<RectTransform>();
            rect.anchorMin = anchor;
            rect.anchorMax = anchor;
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = Vector2.zero;
            rect.sizeDelta = new Vector2(230f, 230f);
            var image = root.GetComponent<Image>();
            image.sprite = NeonAssets.SolidSprite(new Color(1f, 1f, 1f, 1f));
            image.color = new Color(color.r, color.g, color.b, 0.12f);

            var handleObject = new GameObject("Handle", typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
            handleObject.transform.SetParent(root.transform, false);
            var handleRect = handleObject.GetComponent<RectTransform>();
            handleRect.anchorMin = handleRect.anchorMax = new Vector2(0.5f, 0.5f);
            handleRect.sizeDelta = new Vector2(86f, 86f);
            handleObject.GetComponent<Image>().sprite = NeonAssets.SolidSprite(Color.white);
            handleObject.GetComponent<Image>().color = new Color(color.r, color.g, color.b, 0.5f);

            var joystick = root.GetComponent<VirtualJoystick>();
            joystick.background = rect;
            joystick.handle = handleRect;
            joystick.radius = 82f;
            return joystick;
        }

        public void OnPointerDown(PointerEventData eventData)
        {
            IsHeld = true;
            UpdateValue(eventData);
        }

        public void OnDrag(PointerEventData eventData) => UpdateValue(eventData);

        public void OnPointerUp(PointerEventData eventData)
        {
            IsHeld = false;
            Value = Vector2.zero;
            handle.anchoredPosition = Vector2.zero;
        }

        private void UpdateValue(PointerEventData eventData)
        {
            if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(background, eventData.position, eventData.pressEventCamera, out var local)) return;
            Value = Vector2.ClampMagnitude(local / radius, 1f);
            handle.anchoredPosition = Value * radius;
        }
    }
}
