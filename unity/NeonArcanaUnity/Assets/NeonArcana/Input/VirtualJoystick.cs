using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace NeonArcana
{
    public sealed class VirtualJoystick : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
    {
        public Vector2 Value { get; private set; }
        public bool IsHeld { get; private set; }

        [SerializeField] private RectTransform background;
        [SerializeField] private RectTransform handle;
        [SerializeField] private float radius;

        public static VirtualJoystick Create(Transform parent, string name, Vector2 anchor, Color color)
        {
            var prefab = Resources.Load<GameObject>("Prefabs/MovePad");
            var root = prefab != null ? Instantiate(prefab) : CreateTemplate();
            root.name = name;
            root.transform.SetParent(parent, false);
            var joystick = root.GetComponent<VirtualJoystick>();
            joystick.ResolveReferences();
            joystick.background.anchorMin = anchor;
            joystick.background.anchorMax = anchor;
            var backgroundImage = root.GetComponent<Image>();
            backgroundImage.color = new Color(color.r, color.g, color.b, 0.12f);
            var handleImage = joystick.handle != null ? joystick.handle.GetComponent<Image>() : null;
            if (handleImage != null) handleImage.color = new Color(color.r, color.g, color.b, 0.5f);
            return joystick;
        }

        public static GameObject CreateTemplate()
        {
            var root = new GameObject("MovePad", typeof(RectTransform), typeof(CanvasRenderer), typeof(Image), typeof(VirtualJoystick));
            var rect = root.GetComponent<RectTransform>();
            rect.anchorMin = new Vector2(0.12f, 0.18f);
            rect.anchorMax = new Vector2(0.12f, 0.18f);
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = Vector2.zero;
            rect.sizeDelta = new Vector2(230f, 230f);
            var image = root.GetComponent<Image>();
            image.sprite = NeonAssets.SolidSprite(new Color(1f, 1f, 1f, 1f));
            image.color = new Color(0.2f, 0.9f, 1f, 0.12f);

            var handleObject = new GameObject("Handle", typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
            handleObject.transform.SetParent(root.transform, false);
            var handleRect = handleObject.GetComponent<RectTransform>();
            handleRect.anchorMin = handleRect.anchorMax = new Vector2(0.5f, 0.5f);
            handleRect.sizeDelta = new Vector2(86f, 86f);
            handleObject.GetComponent<Image>().sprite = NeonAssets.SolidSprite(Color.white);
            handleObject.GetComponent<Image>().color = new Color(0.2f, 0.9f, 1f, 0.5f);

            var joystick = root.GetComponent<VirtualJoystick>();
            joystick.background = rect;
            joystick.handle = handleRect;
            joystick.radius = 82f;
            return root;
        }

        private void Awake()
        {
            ResolveReferences();
        }

        private void ResolveReferences()
        {
            if (background == null) background = GetComponent<RectTransform>();
            if (handle == null)
            {
                var handleTransform = transform.Find("Handle");
                if (handleTransform != null) handle = handleTransform.GetComponent<RectTransform>();
            }
            if (radius <= 0f) radius = 82f;
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
            if (handle != null) handle.anchoredPosition = Vector2.zero;
        }

        private void UpdateValue(PointerEventData eventData)
        {
            if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(background, eventData.position, eventData.pressEventCamera, out var local)) return;
            Value = Vector2.ClampMagnitude(local / radius, 1f);
            if (handle != null) handle.anchoredPosition = Value * radius;
        }

        public void SetExternalValue(Vector2 value)
        {
            IsHeld = value.sqrMagnitude > 0.0001f;
            Value = Vector2.ClampMagnitude(value, 1f);
            if (handle != null) handle.anchoredPosition = Value * radius;
        }

        public void ReleaseExternal()
        {
            IsHeld = false;
            Value = Vector2.zero;
            if (handle != null) handle.anchoredPosition = Vector2.zero;
        }
    }

}
