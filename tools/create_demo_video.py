from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
FRAMES = ROOT / "demo-frames"
OUTPUT = ROOT.parent / "day7-1-明远湖大豆包-刘星宇-智能瞭望与智能问数系统v0.3版演示.mp4"
SIZE = (1280, 720)
FPS = 30

CAPTIONS = [
    "前台登录：普通用户进入智能工作台",
    "智能问数：首页支持自然语言提问",
    "智能问数：自动生成分析结论与数据图表",
    "AI 问答：支持普通问题和 @数字员工",
    "@文案专员：生成宣传文案并记录任务",
    "数字员工中心：文案、天气、采集三类员工",
    "报表呈现：趋势、数据源和模型效果报告",
    "任务列表：追踪数字员工执行结果与进度",
    "模型切换：按任务选择不同模型",
    "后台登录：管理员独立入口",
    "后台工作台：采集、数据源、仓库和模型概览",
    "数字员工管理：配置能力、模型与提示词",
]


def font(size):
    candidates = [Path("C:/Windows/Fonts/msyh.ttc"), Path("C:/Windows/Fonts/simhei.ttf")]
    target = next((item for item in candidates if item.exists()), None)
    return ImageFont.truetype(str(target), size) if target else ImageFont.load_default()


def title_frame():
    image = Image.new("RGB", SIZE, "#09263a")
    draw = ImageDraw.Draw(image)
    draw.ellipse((-120, -180, 520, 460), fill="#0d6b70")
    draw.ellipse((920, 390, 1450, 920), fill="#154964")
    draw.text((100, 190), "智能瞭望与智能问数系统", font=font(52), fill="white")
    draw.text((102, 270), "V0.3 前后台功能演示", font=font(30), fill="#78ded4")
    draw.text((102, 335), "明远湖大豆包 · 刘星宇", font=font(22), fill="#b9d2d9")
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


def caption_frame(path, caption):
    image = Image.open(path).convert("RGB").resize(SIZE)
    overlay = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rounded_rectangle((36, 636, 850, 698), radius=14, fill=(6, 31, 47, 220))
    draw.text((58, 652), caption, font=font(22), fill="white")
    image = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


def main():
    paths = sorted(FRAMES.glob("*.png"))
    frames = [title_frame()] + [caption_frame(path, CAPTIONS[index]) for index, path in enumerate(paths)]
    writer = cv2.VideoWriter(str(OUTPUT), cv2.VideoWriter_fourcc(*"mp4v"), FPS, SIZE)
    if not writer.isOpened():
        raise RuntimeError("无法初始化 MP4 编码器")
    hold = int(2.2 * FPS)
    fade = int(0.35 * FPS)
    for index, current in enumerate(frames):
        for _ in range(hold):
            writer.write(current)
        if index + 1 < len(frames):
            following = frames[index + 1]
            for step in range(1, fade + 1):
                alpha = step / (fade + 1)
                writer.write(cv2.addWeighted(current, 1 - alpha, following, alpha, 0))
    writer.release()
    print(OUTPUT)


if __name__ == "__main__":
    main()
