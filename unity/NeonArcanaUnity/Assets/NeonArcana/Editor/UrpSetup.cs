using System;
using System.IO;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace NeonArcana.Editor
{
    /// <summary>
    /// 웹 원본의 네온 발광(ctx.shadowBlur)을 Unity에서 재현하기 위한 URP 2D 파이프라인 구성.
    /// 빌트인 렌더 파이프라인에는 블룸이 없어 아무리 스프라이트를 잘 배치해도 납작하게 보이므로,
    /// URP 2D 렌더러 + 글로벌 볼륨 블룸으로 전환한다.
    /// 에셋을 수동으로 만들지 않고 스크립트로 생성해 재현 가능하게 유지한다.
    /// </summary>
    public static class UrpSetup
    {
        private const string PipelineDirectory = "Assets/Settings";
        private const string RendererPath = PipelineDirectory + "/NeonArcana2DRenderer.asset";
        private const string PipelinePath = PipelineDirectory + "/NeonArcanaUrpAsset.asset";

        public static void ConfigureBatch()
        {
            if (!Directory.Exists(PipelineDirectory)) Directory.CreateDirectory(PipelineDirectory);

            var renderer = AssetDatabase.LoadAssetAtPath<Renderer2DData>(RendererPath);
            if (renderer == null)
            {
                renderer = ScriptableObject.CreateInstance<Renderer2DData>();
                AssetDatabase.CreateAsset(renderer, RendererPath);
            }

            var pipeline = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(PipelinePath);
            if (pipeline == null)
            {
                pipeline = UniversalRenderPipelineAsset.Create(renderer);
                AssetDatabase.CreateAsset(pipeline, PipelinePath);
            }

            // HDR과 후처리가 켜져 있어야 블룸이 실제로 빛 번짐을 만든다.
            pipeline.supportsHDR = true;
            EditorUtility.SetDirty(pipeline);
            EditorUtility.SetDirty(renderer);

            GraphicsSettings.defaultRenderPipeline = pipeline;
            QualitySettings.renderPipeline = pipeline;

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            if (GraphicsSettings.defaultRenderPipeline == null)
                throw new InvalidOperationException("URP pipeline asset was not assigned.");

            Debug.Log($"NEON_ARCANA_URP_SETUP_OK pipeline={pipeline.name} renderer=Renderer2D hdr={pipeline.supportsHDR}");
        }
    }
}
