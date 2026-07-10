import { Editor } from "@tinymce/tinymce-react";
import "tinymce/tinymce";
import "tinymce/icons/default";
import "tinymce/themes/silver";
import "tinymce/models/dom";
import "tinymce/plugins/advlist";
import "tinymce/plugins/autolink";
import "tinymce/plugins/autoresize";
import "tinymce/plugins/charmap";
import "tinymce/plugins/code";
import "tinymce/plugins/fullscreen";
import "tinymce/plugins/help";
import "tinymce/plugins/link";
import "tinymce/plugins/lists";
import "tinymce/plugins/searchreplace";
import "tinymce/plugins/table";
import "tinymce/plugins/visualblocks";
import "tinymce/plugins/wordcount";
import "tinymce/skins/ui/oxide/skin.css";
import "tinymce/skins/content/default/content.css";

export function RichTextEditor({ id, value, onChange, compact = false }: { id: string; value: string; onChange: (value: string) => void; compact?: boolean }) {
  return <div className="tiny-editor-shell"><Editor key={id} licenseKey="gpl" value={value} onEditorChange={onChange} init={{
    height: compact ? 190 : 260, min_height: compact ? 160 : 220, max_height: 520,
    menubar: false, branding: false, promotion: false, statusbar: true, skin: false, content_css: false,
    plugins: "advlist autolink autoresize charmap code fullscreen help link lists searchreplace table visualblocks wordcount",
    toolbar: "undo redo | blocks fontfamily fontsize | bold italic underline forecolor backcolor | bullist numlist | link table | charmap visualblocks | removeformat code fullscreen",
    block_formats: "Paragraph=p; Heading 2=h2; Heading 3=h3; Heading 4=h4",
    font_family_formats: "Arial=Arial,Helvetica,sans-serif; Calibri=Calibri,Arial,sans-serif; Georgia=Georgia,serif; Tahoma=Tahoma,Arial,sans-serif; Times New Roman=\"Times New Roman\",Times,serif; Trebuchet MS=\"Trebuchet MS\",Arial,sans-serif; Verdana=Verdana,Arial,sans-serif",
    font_size_formats: "12px 14px 16px 18px 20px 24px 28px 32px 36px 48px",
    autoresize_bottom_margin: 12,
    content_style: "body{font-family:Arial,sans-serif;font-size:16px;line-height:1.55;padding:4px 10px}p{margin:0 0 .85rem}h2,h3,h4{line-height:1.25;margin:0 0 .75rem}"
  }} /></div>;
}
