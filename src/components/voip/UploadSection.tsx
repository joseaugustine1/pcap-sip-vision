import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const UploadSection = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [sessionName, setSessionName] = useState("");
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (files.length === 0 || !sessionName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a session name and select at least one PCAP file",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Create analysis session
      const { data: session, error: sessionError } = await supabase
        .from("analysis_sessions")
        .insert([{ name: sessionName, status: "processing" }])
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Upload files
      for (const file of files) {
        const filePath = `${session.id}/${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from("pcap-files")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Store file reference
        await supabase.from("pcap_files").insert([{
          session_id: session.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
        }]);
      }

      // Trigger analysis
      const { error: functionError } = await supabase.functions.invoke("analyze-pcap", {
        body: { sessionId: session.id },
      });

      if (functionError) throw functionError;

      toast({
        title: "Upload Successful",
        description: `${files.length} file(s) uploaded and analysis started`,
      });

      // Reset form
      setFiles([]);
      setSessionName("");
      const fileInput = document.getElementById("pcap-files") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-border shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Upload className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Upload PCAP Files</h2>
          <p className="text-sm text-muted-foreground">Analyze multiple captures for VoIP quality metrics</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="session-name">Session Name</Label>
          <Input
            id="session-name"
            placeholder="e.g., Production Call Quality - Jan 2024"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            disabled={uploading}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="pcap-files">PCAP Files</Label>
          <Input
            id="pcap-files"
            type="file"
            accept=".pcap,.pcapng,.cap"
            multiple
            onChange={handleFileChange}
            disabled={uploading}
            className="mt-1.5"
          />
          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              {files.map((file, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded-md">
                  <FileCheck className="w-4 h-4 text-success" />
                  <span className="flex-1">{file.name}</span>
                  <span className="text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button 
          onClick={handleUpload} 
          disabled={uploading || files.length === 0 || !sessionName.trim()}
          className="w-full"
          size="lg"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading & Analyzing...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload & Analyze
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};
