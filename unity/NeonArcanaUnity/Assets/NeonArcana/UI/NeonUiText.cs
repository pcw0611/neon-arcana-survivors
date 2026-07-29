using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace NeonArcana
{
    /// <summary>TMP 전환 과정에서 공유하는 텍스트 헬퍼.</summary>
    public static class NeonUiText
    {
        /// <summary>기존 레거시 Text의 TextAnchor 지정을 TMP 정렬로 옮긴다.</summary>
        public static TextAlignmentOptions MapAlignment(TextAnchor anchor) => anchor switch
        {
            TextAnchor.UpperLeft => TextAlignmentOptions.TopLeft,
            TextAnchor.UpperCenter => TextAlignmentOptions.Top,
            TextAnchor.UpperRight => TextAlignmentOptions.TopRight,
            TextAnchor.MiddleLeft => TextAlignmentOptions.Left,
            TextAnchor.MiddleCenter => TextAlignmentOptions.Center,
            TextAnchor.MiddleRight => TextAlignmentOptions.Right,
            TextAnchor.LowerLeft => TextAlignmentOptions.BottomLeft,
            TextAnchor.LowerCenter => TextAlignmentOptions.Bottom,
            _ => TextAlignmentOptions.BottomRight,
        };
    }
}
