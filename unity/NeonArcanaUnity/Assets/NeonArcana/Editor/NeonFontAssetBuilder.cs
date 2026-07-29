using System;
using System.IO;
using TMPro;
using UnityEditor;
using UnityEngine;
using UnityEngine.TextCore.LowLevel;

namespace NeonArcana.Editor
{
    /// <summary>
    /// TMP 폰트 에셋을 프로젝트에 실제 파일로 굽는다.
    ///
    /// 런타임에 <see cref="TMP_FontAsset.CreateFontAsset"/>로 만든 폰트는 디스크에 존재하지 않는
    /// 임시 ScriptableObject라, 프리팹의 font 필드에 넣어도 직렬화되지 않고 null로 저장된다.
    /// 그래서 빌드에서는 TMP 기본 폰트(LiberationSans)로 되돌아가 한글이 전부 두부(□)로 나온다.
    /// 에셋으로 구워두면 프리팹이 GUID로 참조하므로 빌드에도 그대로 따라간다.
    ///
    /// 아틀라스는 Dynamic 모드라 실제 글리프는 런타임에 필요한 것만 구워진다.
    /// (한글 전체를 미리 구우면 아틀라스가 수십 MB로 불어난다.)
    /// </summary>
    public static class NeonFontAssetBuilder
    {
        private const string FontDirectory = "Assets/Resources/Fonts";
        private const string KoreanSourcePath = FontDirectory + "/NeonArcanaKorean.ttf";
        private const string KoreanAssetPath = FontDirectory + "/NeonArcanaKoreanSDF.asset";
        private const string SymbolSourcePath = FontDirectory + "/NeonArcanaSymbols.ttf";
        private const string SymbolAssetPath = FontDirectory + "/NeonArcanaSymbolsSDF.asset";

        [MenuItem("Neon Arcana/Fonts/Rebuild TMP Font Assets")]
        public static void BuildBatch()
        {
            EnsureSourceFont(KoreanSourcePath, "malgun.ttf");
            // ✦ ▾ ★ 같은 아이콘 글리프는 맑은 고딕에 없다. 심볼 폰트를 폴백으로 붙인다.
            EnsureSourceFont(SymbolSourcePath, "seguisym.ttf");
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);

            var korean = CreateSdfAsset(KoreanSourcePath, KoreanAssetPath, "NeonArcana Korean SDF");
            var symbols = CreateSdfAsset(SymbolSourcePath, SymbolAssetPath, "NeonArcana Symbols SDF");

            if (korean != null && symbols != null)
            {
                korean.fallbackFontAssetTable ??= new System.Collections.Generic.List<TMP_FontAsset>();
                korean.fallbackFontAssetTable.Clear();
                korean.fallbackFontAssetTable.Add(symbols);
                EditorUtility.SetDirty(korean);
            }

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            Debug.Log($"NEON_ARCANA_FONT_ASSETS_OK korean={(korean != null ? korean.name : "null")} symbols={(symbols != null ? symbols.name : "null")}");
        }

        private static void EnsureSourceFont(string projectPath, string systemFileName)
        {
            if (File.Exists(projectPath)) return;
            if (!Directory.Exists(FontDirectory)) Directory.CreateDirectory(FontDirectory);
            var source = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "Fonts", systemFileName);
            if (!File.Exists(source)) throw new InvalidOperationException($"System font missing: {source}");
            File.Copy(source, projectPath, false);
            AssetDatabase.ImportAsset(projectPath, ImportAssetOptions.ForceUpdate);
        }

        private static TMP_FontAsset CreateSdfAsset(string sourcePath, string assetPath, string assetName)
        {
            var source = AssetDatabase.LoadAssetAtPath<Font>(sourcePath);
            if (source == null) throw new InvalidOperationException($"Font source not imported: {sourcePath}");

            var fontAsset = TMP_FontAsset.CreateFontAsset(
                source,
                90,
                9,
                GlyphRenderMode.SDFAA,
                1024,
                1024,
                AtlasPopulationMode.Dynamic);
            if (fontAsset == null) throw new InvalidOperationException($"CreateFontAsset failed for {sourcePath}");
            fontAsset.name = assetName;

            AssetDatabase.DeleteAsset(assetPath);
            AssetDatabase.CreateAsset(fontAsset, assetPath);

            // 아틀라스 텍스처와 머티리얼은 서브에셋으로 붙이지 않으면 저장 시 사라진다.
            if (fontAsset.atlasTextures is { Length: > 0 })
            {
                fontAsset.atlasTextures[0].name = assetName + " Atlas";
                AssetDatabase.AddObjectToAsset(fontAsset.atlasTextures[0], fontAsset);
            }
            if (fontAsset.material != null)
            {
                fontAsset.material.name = assetName + " Material";
                AssetDatabase.AddObjectToAsset(fontAsset.material, fontAsset);
            }

            EditorUtility.SetDirty(fontAsset);
            return fontAsset;
        }
    }
}
