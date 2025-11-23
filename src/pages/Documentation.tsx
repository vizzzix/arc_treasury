import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Download, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Documentation = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="border-b border-border/30 bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-6 py-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Home</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Title */}
          <div className="text-center space-y-4">
            <h1 className="text-5xl font-bold">Documentation</h1>
            <p className="text-xl text-muted-foreground">
              Learn about Arc Treasury protocol, architecture, and vision
            </p>
          </div>

          {/* Documents Grid */}
          <div className="grid md:grid-cols-1 gap-6 max-w-2xl mx-auto">
            {/* Litepaper */}
            <div className="p-8 rounded-2xl border border-border/50 bg-card hover:border-primary/50 transition-all group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold">Litepaper</h3>
                <p className="text-muted-foreground">
                  Comprehensive overview of Arc Treasury protocol, technology, business model, and roadmap
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={() => navigate("/litepaper")}
                    className="flex-1"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Read Online
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <Download className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Resources */}
          <div className="pt-8 border-t border-border/30">
            <h2 className="text-2xl font-bold mb-6">Additional Resources</h2>
            <div className="grid gap-4">
              <a
                href="https://github.com/vizzzix/arc_treasury"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded-lg border border-border/50 hover:border-primary/50 transition-colors flex items-center justify-between group"
              >
                <div>
                  <h4 className="font-semibold group-hover:text-primary transition-colors">
                    GitHub Repository
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Open source smart contracts and frontend code
                  </p>
                </div>
                <ExternalLink className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </a>

              <a
                href="https://twitter.com/arc_treasury"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded-lg border border-border/50 hover:border-primary/50 transition-colors flex items-center justify-between group"
              >
                <div>
                  <h4 className="font-semibold group-hover:text-primary transition-colors">
                    Twitter / X
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Follow us for updates and announcements
                  </p>
                </div>
                <ExternalLink className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </a>

              <button
                onClick={() => navigate("/faq")}
                className="p-4 rounded-lg border border-border/50 hover:border-primary/50 transition-colors flex items-center justify-between group text-left"
              >
                <div>
                  <h4 className="font-semibold group-hover:text-primary transition-colors">
                    Frequently Asked Questions
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Common questions about Arc Treasury
                  </p>
                </div>
                <ExternalLink className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Documentation;
