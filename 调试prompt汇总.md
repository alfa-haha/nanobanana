请你对核心功能区进行以下调整：
1. 将aspect ratio，style设置为折叠样式，水平布局在prompt输入框的左下角；用户点击自动向下展开可选项，鼠标离开或者选中收起；
2. 在prompt输入框右下角，设置一个clear按钮；方便用户一键清除prompt内容；
3. prompt输入框默认高度增加20%；
4. 测试发现：点击image to image，无法切换到图生图模式；正常状态为：用户点击image to image,切换到该模式，用户可以通过点击或者拖拽上传图片，然后在prompt输入框输入，点击aspect ratio(可选），style（可选），最后点击生成按钮；


你的修改并未完成，请你将aspect ratio和style布置在prompt输入区域左下方，不需要设置外框，默认状态下融入prompt输入框效果，当用户鼠标触及时淡出且显示椭圆形按钮